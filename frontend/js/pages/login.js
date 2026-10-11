// Login page: checks credentials with backendLogin/server.js, then goes to the submit page.

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("message");

// already logged in -> skip straight to submitting
getSession()
  .then((session) => { if (session.loggedIn) window.location.href = "submit.html"; })
  .catch(() => {});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    const result = await login(username, password);
    if (result.success) {
      window.location.href = "submit.html";
    } else {
      loginMessage.innerText = result.message || "Invalid login.";
    }
  } catch (error) {
    console.error(error);
    loginMessage.innerText = "Server error. Is the server running? (npm start in backendLogin)";
  }
});
