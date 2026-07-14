const passport = require('passport');

const GoogleStrategy =
   require('passport-google-oauth20').Strategy;

const User = require('../models/user.model');

passport.use(

   new GoogleStrategy(

      {

         clientID:
            process.env.GOOGLE_CLIENT_ID,

         clientSecret:
            process.env.GOOGLE_CLIENT_SECRET,

         callbackURL:
            process.env.GOOGLE_CALLBACK_URL

      },

      async (

         accessToken,
         refreshToken,
         profile,
         done

      ) => {

         try {

            // ==========================
            // EMAIL SAFETY CHECK
            // ==========================

            const email =

               profile?.emails?.[0]?.value
                  ?.trim()
                  ?.toLowerCase();

            if (!email) {

               return done(

                  new Error(
                     'Google account has no email'
                  ),

                  null

               );

            }
            // 🔒 SECURITY
            if (
               profile._json &&
               profile._json.email_verified === false
            ) {
               return done(
                  new Error('Google email not verified'),
                  null
               );
            }
            // ==========================
            // FIND USER BY EMAIL
            // ==========================

            let user = await User.findOne({

               email

            });

            // ==========================
            // EXISTING USER
            // MERGE GOOGLE ACCOUNT
            // ==========================

            if (user) {

               // Prevent mismatched Google linking

               if (

                  user.googleId &&

                  user.googleId !== profile.id

               ) {

                  return done(

                     new Error(
                        'Google account mismatch'
                     ),

                     null

                  );

               }

               // First Google login for local account

               if (!user.googleId) {

                  user.googleId =
                     profile.id;

               }

               // Save avatar only if empty

               if (

                  !user.avatar &&

                  profile.photos?.[0]?.value

               ) {

                  user.avatar =
                     profile.photos[0].value;

               }

               await user.save();

               return done(
                  null,
                  user
               );

            }

            // ==========================
            // GENERATE UNIQUE USERNAME
            // ==========================

            const baseUsername = (

               profile.displayName ||

               email.split('@')[0]

            )

               .replace(/\s+/g, '')
               .toLowerCase()
               .slice(0, 20);

            let username =
               baseUsername;

            let counter = 1;

            while (

               await User.findOne({

                  username

               })

            ) {

               username =

                  `${baseUsername}${counter}`;

               counter++;

            }

            // ==========================
            // CREATE GOOGLE USER
            // ==========================

            user = await User.create({

               username,

               email,

               googleId:
                  profile.id,

               provider:
                  'google',

               avatar:
                  profile.photos?.[0]?.value || ''

            });

            return done(
               null,
               user
            );

         }

         catch (err) {

            console.error(
               'Google OAuth Error:',
               err
            );

            return done(
               err,
               null
            );

         }

      }

   )

);

module.exports = passport;