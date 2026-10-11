# Civic Link
A website aimed to let city engineers post construction updates about their community.

# Where code lives (frontend/js)
- config.js — tokens, sheet ID, URLs, map defaults
- projects.js — converts Google Sheet rows to/from Project objects (only file that knows the sheet format)
- api.js — all fetches (sheet, Apps Script, geocoding, login)
- render.js — map popups, update cards, recent list
- map.js — map + search box + markers
- project-search.js — keyword search/ranking of projects (title matches rank above address/description)
- nav.js / search.js — shared navbar (edit NAV_LINKS to add a page) and search popup
- pages/*.js — one script per page; each HTML file loads only what it needs

Shared styles go in css/index.css; page-only styles in that page's css file.

# To Do List:

Frontend:
- create div that appears in home page for every project submitted (DONE)
- reposition the submit form so it's maneuverable (look at backend notes below) (DONE)
- make the updates list look pretty 
- Remove the address box (Don't worry it's useless now )


Backend:
- Lock in map markers onto map when press submit (Should be done?)
- make home-page display map uneditable (Already done?)
- Make adding a description possible (DONE)
- Expand google sheet database to allow expandable info based when clicking tabs
    - add/link current news about given construction
    - link communities/headlines 

- Filtering by 
- More tags in each construction to filter by type
- make way to edit submission
   - I dont have enough time to make this a feature







- ~~Location doesn't work~~
- ~~Find way to allow user to submit google coords~~
- ~~Create login backend (w/ node.js and host it to the internet using a free site like Render)~~

# RUNNING THE SITE (NODE.JS SERVER)
Full step-by-step instructions: see RUNNING.md

The Node server in backendLogin/ hosts the whole website AND handles login + submissions,
so open the site through it (not Live Server or by double-clicking the HTML files), or login won't work.

1) download node.js
2) in vscode terminal: "cd backendLogin", then "npm install" (first time only), then "npm start"
3) open http://localhost:3000
4) to turn off server: "ctrl+C" in terminal

How login works:
- Accounts live in backendLogin/users.json (passwords are hashed, not readable)
- Add/change an account: "npm run add-user -- <username> <password>" (from backendLogin/); takes effect right away
- submit.html redirects to the login page unless you're logged in
- Submissions go to the server, which checks the login and then sends them to the Google Apps Script
- Logins reset when the server restarts

# Key things to note abt messy backend
- Google maps have been switched to mapbox 

- mapbox REQUIRES you to include it's own stylesheet (for specifying map) and it's own js sheet 
    put the following code into the <head> of any HTML file if you want a map there
    ~
    <link href='https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.css' rel='stylesheet' />
    <script defer src='https://api.mapbox.com/mapbox-gl-js/v3.15.0/mapbox-gl.js'></script>
    ~
- The physical map itself will be <div id = "map"></div>
    - if you're not testing it's functions change it's id to <div id = "map-test"></div> to make it turn green 
    - or just change it to anything other than the id "map"

- After that you need to have this in the script section of the page, very much customizable 
<script>
function loadmap(){

  mapboxgl.accessToken = 'pk.eyJ1IjoiY2l2aWMtbGluayIsImEiOiJjbWdwbzd6c2kyY3dyMmpuMnpxMTBrMm13In0.KY2MzBxSk5XV2TcEWe3MQA';
  const map = new mapboxgl.Map({
	container: 'map', // container ID
	style: 'mapbox://styles/mapbox/streets-v12', // style URL
	center: [-74.5, 40], // starting position [lng, lat]
	zoom: 8, // starting zoom
    });
}
loadmap();
<script>

Google Sheets:
https://docs.google.com/spreadsheets/d/1UK356MwkhS73fkZHGkeQwS_UBx9YpTf9dIunNaGbXLw/edit?gid=0#gid=0


