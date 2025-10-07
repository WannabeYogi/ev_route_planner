import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import NextAuth from 'next-auth';
import User from '@/app/models/User';
import bcrypt from 'bcrypt';
import connectToDatabase from '@/app/utils/mongodb';

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    
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
  
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  
  pages: {
    signIn: '/login',
  },
  
  callbacks: {
    async jwt({ token, user, account, profile }) {
      if (user) {
        token.userId = user.userId;
        token.id = user.id;
      }
      return token;
    },
    
    async session({ session, token }) {
      if (session?.user && token) {
        session.user.id = token.id;
        session.user.userId = token.userId;
      }
      return session;
    },
    
    async signIn({ user, account, profile }) {
      if (account.provider === 'google') {
        try {
          await connectToDatabase();
          
          let dbUser = await User.findOne({ email: profile.email });
          
          if (!dbUser) {
            dbUser = await User.create({
              name: profile.name,
              email: profile.email,
              image: profile.picture,
              googleId: profile.sub
            });
            
            user.userId = dbUser.userId;
            user.id = dbUser._id.toString();
          } else {
            if (!dbUser.googleId) {
              await User.findByIdAndUpdate(dbUser._id, {
                googleId: profile.sub,
                image: profile.picture || dbUser.image
              },{new: true});
            }
            
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
  
  secret: process.env.NEXTAUTH_SECRET
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
