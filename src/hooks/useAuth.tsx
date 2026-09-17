'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { 
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  Auth
} from 'firebase/auth'
import { doc, getDoc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase/client'

interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'manager' | 'operator' | 'admin'
  created_at: any
}

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName: string) => Promise<{ matchedPersonnel: any | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        // Fetch profile
        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (profileDoc.exists()) {
          setProfile(profileDoc.data() as UserProfile)
        } else {
          // Try to find personnel match and create profile
          const personnelQuery = query(collection(db, 'personnel'), where('email', '==', firebaseUser.email?.toLowerCase()))
          const personnelSnap = await getDocs(personnelQuery)
          
          if (!personnelSnap.empty) {
            const personnel = personnelSnap.docs[0].data()
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              email: firebaseUser.email!.toLowerCase(),
              full_name: personnel.full_name,
              role: personnel.role,
              created_at: new Date()
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile)
            setProfile(newProfile)

            // Link assignments
            const assignmentsQuery = query(collection(db, 'jobAssignments'), where('personnel_id', '==', personnelSnap.docs[0].id))
            const assignmentsSnap = await getDocs(assignmentsQuery)
            for (const assignmentDoc of assignmentsSnap.docs) {
              await updateDoc(doc(db, 'jobAssignments', assignmentDoc.id), {
                profile_id: firebaseUser.uid
              })
            }
          } else {
            // Check if first user - become manager
            const usersSnap = await getDocs(collection(db, 'users'))
            const isFirstUser = usersSnap.empty
            
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              email: firebaseUser.email!.toLowerCase(),
              full_name: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
              role: isFirstUser ? 'manager' : 'operator',
              created_at: new Date()
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile)
            setProfile(newProfile)
          }
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    // Check personnel exists
    const personnelQuery = query(collection(db, 'personnel'), where('email', '==', email.toLowerCase().trim()))
    const personnelSnap = await getDocs(personnelQuery)
    
    let matchedPersonnel = null
    if (!personnelSnap.empty) {
      matchedPersonnel = { id: personnelSnap.docs[0].id, ...personnelSnap.docs[0].data() }
    } else {
      // Check if any personnel exists at all
      const allPersonnelSnap = await getDocs(collection(db, 'personnel'))
      if (!allPersonnelSnap.empty) {
        throw new Error('This email is not registered. Please ask your manager to add you in Personnel Management first.')
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email.toLowerCase().trim(), password)
    const firebaseUser = userCredential.user

    const role = matchedPersonnel?.role || 'manager'
    const name = fullName || matchedPersonnel?.full_name || email.split('@')[0]

    const newProfile: UserProfile = {
      id: firebaseUser.uid,
      email: email.toLowerCase().trim(),
      full_name: name,
      role,
      created_at: new Date()
    }

    await setDoc(doc(db, 'users', firebaseUser.uid), newProfile)

    if (matchedPersonnel) {
      const assignmentsQuery = query(collection(db, 'jobAssignments'), where('personnel_id', '==', matchedPersonnel.id))
      const assignmentsSnap = await getDocs(assignmentsQuery)
      for (const assignmentDoc of assignmentsSnap.docs) {
        await updateDoc(doc(db, 'jobAssignments', assignmentDoc.id), {
          profile_id: firebaseUser.uid
        })
      }
    }

    return { matchedPersonnel }
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
