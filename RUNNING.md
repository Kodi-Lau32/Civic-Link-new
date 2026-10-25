# Running Civic Link

The Node server in `backendLogin/` runs the whole site: the pages, login, and project submissions.
Always open the site through this server. Live Server and double-clicking the HTML files won't work, because login and submit depend on the server.

## 1. Install Node.js (first time only)

Download and install the LTS version from https://nodejs.org.
To check that it worked, open a terminal and run:

```
node -v
```

You should see a version number such as `v22.x.x`.

## 2. Install dependencies (first time only)

In the VS Code terminal, from the project folder:

```
cd backendLogin
npm install
```

## 3. Connect the database (first time only)

Projects are stored in a Supabase database.

1. Create a free project at https://supabase.com.
2. In the Supabase dashboard, open **SQL Editor > New query**, paste in everything from `supabase/schema.sql`, and press **Run**.
3. Open **Project Settings > API Keys** (the project URL is under **Data API**) and copy:
   - the **publishable** key (or the older **anon** key) and the project URL into `frontend/js/config.js`, where it says `PASTE YOUR SUPABASE VALUES HERE`. This key can only read, so it's fine for it to be public.
   - the **secret** key (or the older **service_role** key) and the project URL into `backendLogin/.env`. Make that file by copying `backendLogin/.env.example`. Never put the secret key in `frontend/` or commit it, because it can change anything in the database. `.env` is already in `.gitignore`.
4. Optional: copy the projects from the old Google Sheet. From the `backendLogin` folder, run `npm run import-sheet`. Running it again won't make duplicates.

## 4. Start the server

From the `backendLogin` folder:

```
npm start
```

When it's running you'll see:

```
✅ Server running on http://localhost:3000
```

Leave this terminal open. The site only works while the server is running.

## 5. Open the site

Go to **http://localhost:3000** in your browser.

## 6. Log in and submit a project

1. Click **Login** in the navbar.
2. Enter your username and password.
3. You'll land on your **Dashboard**, which lists every project you've submitted.
4. Click **+ Submit a new project**, fill in the form, click the map to place the project, and press **Submit**.
5. To change one of your projects, click **Edit** on its card in the Dashboard, make your changes, and press **Save changes**.

The Submit and Dashboard pages send you back to Login if you aren't logged in. You can only edit projects you submitted yourself. Logins reset whenever the server restarts.

## 7. Stop the server

Press `Ctrl + C` in the terminal where the server is running.

---

## Managing accounts

Accounts are stored in `backendLogin/users.json` with hashed passwords, so they can't be read from the file.
To add an account or change a password, run this from the `backendLogin` folder:

```
npm run add-user -- <username> <password>
```

For example, `npm run add-user -- jsmith MyStrongPassword`. The change takes effect right away; you don't need to restart.

To delete an account, remove its entry from `users.json`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Login says **"Server error"** | The server isn't running, or you opened the page some other way (Live Server, or the file directly). Start the server and use http://localhost:3000. |
| **`EADDRINUSE`** when starting | Another program is using port 3000. Stop that program, or pick a different port: `PORT=3001 npm start`, then open http://localhost:3001. |
| **`npm: command not found`** | Node.js isn't installed. Go back to step 1. |
| **`Cannot find module 'express'`** | Run `npm install` in the `backendLogin` folder. |
| **"Too many attempts"** on login | There have been 10 failed logins from your computer. Wait 15 minutes or restart the server. |
| Submitting says **"Your login expired"** | Sessions last 8 hours, and they also end when the server restarts. Log in again. |
| Pages say **"Couldn't load projects"** | `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` in `frontend/js/config.js` are missing or wrong, or `supabase/schema.sql` hasn't been run. The browser console shows the exact error. |
| Submitting says **"Couldn't save the project"** | `backendLogin/.env` is missing or has the wrong secret key. The server prints a warning when it starts if it's missing. Restart the server after changing `.env`. |

## Optional settings

You can set these environment variables when starting the server (or put them in `backendLogin/.env`):

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the site runs on |
| `SUPABASE_URL` | none (set in `.env`) | Your Supabase project URL |
| `SUPABASE_SECRET_KEY` | none (set in `.env`) | Supabase secret key the server uses to save projects |

Example (Mac/Linux): `PORT=8080 npm start`. On Windows PowerShell: `$env:PORT=8080; npm start`
