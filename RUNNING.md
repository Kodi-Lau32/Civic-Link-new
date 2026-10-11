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

## 3. Start the server

From the `backendLogin` folder:

```
npm start
```

When it's running you'll see:

```
✅ Server running on http://localhost:3000
```

Leave this terminal open. The site only works while the server is running.

## 4. Open the site

Go to **http://localhost:3000** in your browser.

## 5. Log in and submit a project

1. Click **Login** in the navbar.
2. Enter your username and password.
3. You'll be taken to the **Submit** page. Fill in the form, click the map to place the project, and press **Submit**.

The Submit page sends you back to Login if you aren't logged in. Logins reset whenever the server restarts.

## 6. Stop the server

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

## Optional settings

You can set these environment variables when starting the server:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | Port the site runs on |
| `SUBMIT_URL` | the current Apps Script URL | Google Apps Script that writes submissions to the Google Sheet |

Example (Mac/Linux): `PORT=8080 npm start`. On Windows PowerShell: `$env:PORT=8080; npm start`
