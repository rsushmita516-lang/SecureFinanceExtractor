import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";


const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";


export const authClient = createAuthClient({
 baseURL: appUrl,
 fetchOptions: {
   credentials: "include"
 },
 plugins: [organizationClient()]
});


export const { signIn, signUp, signOut, useSession, getSession } = authClient;
