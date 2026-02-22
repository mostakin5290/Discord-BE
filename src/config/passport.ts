import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as FacebookStrategy } from "passport-facebook";
import client from "./db.js";
import { env } from "./env.js";
import { AuthService } from "../services/auth/auth.service.js";

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await client.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

const { GOOGLE, GITHUB, FACEBOOK } = env;

if (GOOGLE.CLIENT_ID && GOOGLE.CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE.CLIENT_ID,
        clientSecret: GOOGLE.CLIENT_SECRET,
        callbackURL: `${env.SERVER_BASE_URL}/api/v1/auth/google/callback`,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const user = await AuthService.findOrCreateSocialUser(
            {
              email: profile.emails?.[0]?.value,
              id: profile.id,
              username: null, // Let service handle or generate
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              imageUrl: profile.photos?.[0]?.value,
              accessToken,
              refreshToken,
            },
            "google"
          );
          return done(null, user);
        } catch (error: any) {
          console.log(error)
          return done(error, undefined);
        }
      }
    )
  );
}

if (GITHUB.CLIENT_ID && GITHUB.CLIENT_SECRET) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: GITHUB.CLIENT_ID,
        clientSecret: GITHUB.CLIENT_SECRET,
        callbackURL: `${env.SERVER_BASE_URL}/api/v1/auth/github/callback`,
        scope: ["user:email"],
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: any
      ) => {
        try {
           const [firstName, ...lastNameParts] = (
              profile.displayName ||
              profile.username ||
              "User"
            ).split(" ");
            const lastName = lastNameParts.join(" ");

          const user = await AuthService.findOrCreateSocialUser(
            {
              email: profile.emails?.[0]?.value,
              id: profile.id,
              username: profile.username,
              firstName: firstName,
              lastName: lastName,
              imageUrl: profile.photos?.[0]?.value,
              accessToken,
              refreshToken,
            },
            "github"
          );
           return done(null, user);
        } catch (error: any) {
          return done(error, undefined);
        }
      }
    )
  );
}

if (FACEBOOK.APP_ID && FACEBOOK.APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: FACEBOOK.APP_ID,
        clientSecret: FACEBOOK.APP_SECRET,
        callbackURL: `${env.SERVER_BASE_URL}/api/v1/auth/v1/facebook/callback`,
        profileFields: ["id", "emails", "name"],
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: any,
        done: any
      ) => {
        try {
          const user = await AuthService.findOrCreateSocialUser(
             {
              email: profile.emails?.[0]?.value,
              id: profile.id,
              username: null,
              firstName: profile.name?.givenName,
              lastName: profile.name?.familyName,
              imageUrl: profile.photos?.[0]?.value,
              accessToken,
              refreshToken,
            },
            "facebook"
          );
          return done(null, user);
        } catch (error: any) {
          return done(error, undefined);
        }
      }
    )
  );
}

export default passport;

