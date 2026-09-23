'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth'
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

// Auto-admin email - will always be admin
const ADMIN_EMAIL = 'svanschoor1@yfpo.com'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        const emailLower = firebaseUser.email?.toLowerCase() || ''
        const isAutoAdmin = emailLower === ADMIN_EMAIL.toLowerCase()

        const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid))
        if (profileDoc.exists()) {
          let existingProfile = profileDoc.data() as UserProfile
          
          // Auto-promote svanschoor1@yfpo.com to admin if not already
          if (isAutoAdmin && existingProfile.role !== 'admin') {
            await updateDoc(doc(db, 'users', firebaseUser.uid), { role: 'admin' })
            existingProfile = { ...existingProfile, role: 'admin' }
            // Also update personnel if exists
            try {
              const personnelQuery = query(collection(db, 'personnel'), where('email', '==', emailLower))
              const personnelSnap = await getDocs(personnelQuery)
              if (!personnelSnap.empty) {
                await updateDoc(doc(db, 'personnel', personnelSnap.docs[0].id), { role: 'admin', has_account: true, user_id: firebaseUser.uid })
              }
            } catch {}
          }
          
          setProfile(existingProfile)
        } else {
          const personnelQuery = query(collection(db, 'personnel'), where('email', '==', emailLower))
          const personnelSnap = await getDocs(personnelQuery)
          if (!personnelSnap.empty) {
            const personnel = personnelSnap.docs[0].data()
            const personnelId = personnelSnap.docs[0].id
            const role = isAutoAdmin ? 'admin' : personnel.role
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              email: emailLower,
              full_name: personnel.full_name,
              role,
              created_at: new Date()
            }
            await setDoc(doc(db, 'users', firebaseUser.uid), newProfile)
            setProfile(newProfile)
            await updateDoc(doc(db, 'personnel', personnelId), {
              has_account: true,
              user_id: firebaseUser.uid,
              confirmed_at: new Date(),
              is_active: true,
              ...(isAutoAdmin ? { role: 'admin' } : {})
            })
            const assignmentsQuery = query(collection(db, 'jobAssignments'), where('personnel_id', '==', personnelId))
            const assignmentsSnap = await getDocs(assignmentsQuery)
            for (const assignmentDoc of assignmentsSnap.docs) {
              await updateDoc(doc(db, 'jobAssignments', assignmentDoc.id), { profile_id: firebaseUser.uid })
            }
          } else {
            const usersSnap = await getDocs(collection(db, 'users'))
            const isFirstUser = usersSnap.empty
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              email: emailLower,
              full_name: firebaseUser.displayName || firebaseUser.email!.split('@')[0],
              role: isAutoAdmin ? 'admin' : (isFirstUser ? 'manager' : 'operator'),
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
    const emailLower = email.toLowerCase().trim()
    const isAutoAdmin = emailLower === ADMIN_EMAIL.toLowerCase()
    
    const personnelQuery = query(collection(db, 'personnel'), where('email', '==', emailLower))
    const personnelSnap = await getDocs(personnelQuery)
    let matchedPersonnel = null
    if (!personnelSnap.empty) {
      matchedPersonnel = { id: personnelSnap.docs[0].id, ...personnelSnap.docs[0].data() }
    } else {
      const allPersonnelSnap = await getDocs(collection(db, 'personnel'))
      if (!allPersonnelSnap.empty && !isAutoAdmin) {
        throw new Error('This email is not registered. Ask manager to add you first.')
      }
    }

    const userCredential = await createUserWithEmailAndPassword(auth, emailLower, password)
    const firebaseUser = userCredential.user
    const role = isAutoAdmin ? 'admin' : (matchedPersonnel?.role || 'manager')
    const name = fullName || matchedPersonnel?.full_name || email.split('@')[0]

    const newProfile: UserProfile = {
      id: firebaseUser.uid,
      email: emailLower,
      full_name: name,
      role,
      created_at: new Date()
    }
    await setDoc(doc(db, 'users', firebaseUser.uid), newProfile)

    if (matchedPersonnel) {
      await updateDoc(doc(db, 'personnel', matchedPersonnel.id), {
        has_account: true,
        user_id: firebaseUser.uid,
        confirmed_at: new Date(),
        is_active: true,
        ...(isAutoAdmin ? { role: 'admin' } : {})
      })
      const assignmentsQuery = query(collection(db, 'jobAssignments'), where('personnel_id', '==', matchedPersonnel.id))
      const assignmentsSnap = await getDocs(assignmentsQuery)
      for (const assignmentDoc of assignmentsSnap.docs) {
        await updateDoc(doc(db, 'jobAssignments', assignmentDoc.id), { profile_id: firebaseUser.uid })
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
