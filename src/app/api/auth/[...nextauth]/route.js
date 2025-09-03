import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import NextAuth from 'next-auth';
import User from '@/app/models/User';
import bcrypt from 'bcrypt';
import connectToDatabase from '@/app/utils/mongodb';

export const authOptions = {
  providers: [
    // Google Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    
    // Credentials Provider for email/password login
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }
        
        await connectToDatabase();
        
        // Find user by email
        const user = await User.findOne({ email: credentials.email });
        
        // Check if user exists and password is correct
        if (user && await bcrypt.compare(credentials.password, user.password)) {
          return {
            id: user._id.toString(),
            userId: user.userId,
            name: user.name,
            email: user.email,
            image: user.image
          };
        }
        
        return null;
      }
    })
  ],
  
  // JWT Configuration
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  
  // Custom pages (optional)
  pages: {
    signIn: '/login',
    // signOut: '/auth/signout',
    // error: '/auth/error',
  },
  
  // Callbacks
  callbacks: {
    // Add user info to token
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.userId = user.userId;
        token.id = user.id;
      }
      return token;
    },
    
    // Add user info to session
    async session({ session, token }) {
      if (session?.user && token) {
        session.user.id = token.id;
        session.user.userId = token.userId;
      }
      return session;
    },
    
    // Handle sign in
    async signIn({ user, account, profile }) {
      if (account.provider === 'google') {
        try {
          await connectToDatabase();
          
          // Check if user exists
          let dbUser = await User.findOne({ email: profile.email });
          
          // If not, create new user
          if (!dbUser) {
            dbUser = await User.create({
              name: profile.name,
              email: profile.email,
              image: profile.picture,
              googleId: profile.sub
            });
            
            // Add userId to user object for session
            user.userId = dbUser.userId;
            user.id = dbUser._id.toString();
          } else {
            // Update googleId if it doesn't exist
            if (!dbUser.googleId) {
              await User.findByIdAndUpdate(dbUser._id, {
                googleId: profile.sub,
                image: profile.picture || dbUser.image
              },{new: true});
            }
            
            // Add userId to user object for session
            user.userId = dbUser.userId;
            user.id = dbUser._id.toString();
          }
        } catch (error) {
          console.error('Error during Google sign in:', error);
          return false;
        }
      }
      
      return true;
    }
  },
  
  // Secret for JWT encryption
  secret: process.env.NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
