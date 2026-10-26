# Running Civic Link

Civic Link is a static website: plain HTML, CSS and JavaScript files with no server of its own.
Projects and engineer logins live in Supabase, and the map comes from Mapbox, both reached straight from the browser.

## 1. Set up Supabase (first time only)

1. In the Supabase dashboard, open **SQL Editor > New query**, paste in everything from `supabase/schema.sql`, and press **Run**.
   It's safe to run again; steps that are already done are skipped.
2. Put your project URL and **publishable** key in `frontend/js/config.js`, where it says `PASTE YOUR SUPABASE VALUES HERE`
   (Supabase dashboard > **Project Settings > API Keys**; the URL is under **Data API**).
   This key is meant to be public. On its own it can only read; the database's rules decide what logged-in engineers can change.
3. Turn off public sign-ups so only accounts you create can log in:
   **Authentication > Sign In / Providers**, then turn off **Allow new users to sign up**.

The secret key isn't used anywhere in the website. Never put it in `frontend/` or commit it.

## 2. Add engineer accounts

For each engineer:

1. **Authentication > Users > Add user > Create new user.** Enter their email and a password, and tick **Auto Confirm User**.
2. Give the account a username. This is what's saved as the author of their projects, and only that engineer can edit them.
   In the **SQL Editor**, run this with your values filled in:

   ```sql
   update auth.users
   set raw_app_meta_data = raw_app_meta_data || jsonb_build_object('username', 'kodilau')
   where email = 'their-email@example.com';
   ```

   To keep editing projects you've already submitted, use the same username as before (for example `kodilau`).
3. If they were already logged in, they need to log out and back in to pick up the username.

To change a password: **Authentication > Users**, open the user's menu, and choose the reset or update option.
To remove an account, delete the user there.

## 3. Preview it on your computer

Open the project folder in VS Code, right-click `index.html`, and choose **Open with Live Server**
(install the "Live Server" extension first if you don't have it).

Or, from a terminal in the project folder: `python3 -m http.server 8000`, then open http://localhost:8000.

Opening the HTML files by double-clicking them won't work, because browsers block some requests from `file://` pages.

## 4. Put it online with Render

1. Push the project to GitHub.
2. In Render, choose **New > Static Site** and connect the repository.
3. Settings:
   - **Build Command:** leave empty
   - **Publish Directory:** `.` (the project folder itself, which contains `index.html`)
4. Click **Create Static Site**. Render gives you an address like `https://civiclink.onrender.com`, and redeploys
   automatically every time you push to GitHub.
5. Optional: in Supabase, open **Authentication > URL Configuration** and set **Site URL** to your Render address.
   This is only used by links in emails Supabase sends, such as password resets.

## Troubleshooting

| Problem | Fix |
|---|---|
| Pages say **"Couldn't load projects"** | `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` in `frontend/js/config.js` are missing or wrong, or `supabase/schema.sql` hasn't been run. The browser console shows the exact error. |
| Login says **"Invalid email or password"** | Check the account exists under **Authentication > Users** and is confirmed. |
| Login says **"This account doesn't have a username yet"** | Run the username SQL from step 2 for that email, then log in again. |
| Saving says **"Your account isn't allowed to save projects"** | The account's username is missing. Run the username SQL from step 2, then log out and back in. |
| **Edit** button missing on a project you wrote | The project's `author` doesn't match your username exactly. Fix it in **Table Editor > projects**. |
| Login doesn't work in Live Server, or the map is blank | Make sure you opened the site through Live Server or `http.server`, not by double-clicking the file. |
