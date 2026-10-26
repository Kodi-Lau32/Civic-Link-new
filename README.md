# Civic Link
A website aimed to let city engineers post construction updates about their community.

# Where code lives (frontend/js)
- config.js — tokens, Supabase URL + publishable key, URLs, map defaults
- projects.js — converts database rows to/from Project objects (only file that knows the table's columns)
- api.js — all network requests (Supabase database + logins, Mapbox geocoding)
- render.js — map popups, update cards, recent list
- map.js — map + search box + markers
- project-search.js — keyword search/ranking of projects (title matches rank above address/description)
- nav.js / search.js — shared navbar (edit NAV_LINKS to add a page) and search popup
- pages/*.js — one script per page; each HTML file loads only what it needs
  - pages/dashboard.js — engineer dashboard (your own projects + Edit links)
  - pages/submit.js — submit form; also the edit form when opened as submit.html?edit=<id>
  - pages/project.js — a single project's page (project.html?p=<key>), opened from the Updates page stories

Database: Supabase table "projects", created by supabase/schema.sql (paste it into Supabase > SQL Editor > Run).
The site talks to Supabase directly with the publishable key (frontend/js/config.js). Logins are Supabase Auth, and the
database's rules (Row Level Security, in schema.sql) decide who can add/edit what, so there's no server of our own.

Adding a project type: add it to PROJECT_TYPES and TYPE_COLORS (projects.js), then in the Supabase SQL Editor re-run the
last two lines of supabase/schema.sql (projects_type_check) with the new key added to the list.
Adding a status: add it to PROJECT_STATUSES (projects.js) and to the status check in supabase/schema.sql, e.g.:
  alter table projects drop constraint projects_status_check;
  alter table projects add constraint projects_status_check check (status in ('proposed', ..., 'new_status'));
A project can have several types (tags); the first one sets its color on the map.
Map filters come from FILTER_GROUPS (map.js); the sidebar content is buildProjectDetails (render.js).

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
- Expand google sheet database to allow expandable info based when clicking tabs (done)
    - add/link current news about given construction (need to add editable specific tabs)
    - link communities/headlines (done)

- Filtering by 
- More tags in each construction to filter by type (Done)
- ownership tag (still need to connect to google sheet API)
- make way to edit submission (almost)
   - I dont have enough time to make this a feature
- 


- ~~Location doesn't work~~
- ~~Find way to allow user to submit google coords~~
- ~~Create login backend (w/ node.js and host it to the internet using a free site like Render)~~

# RUNNING THE SITE
Full step-by-step instructions (local preview, accounts, putting it on Render): see RUNNING.md

The site is plain HTML/CSS/JS with no server, so it can be hosted as a static site (e.g. a Render Static Site)
or previewed locally with VS Code's Live Server.

How login works:
- Engineer accounts are Supabase Auth users (Supabase dashboard > Authentication > Users); they log in with email + password
- Each account needs a username set by an admin (see "Adding an engineer account" in RUNNING.md); that's what the "author" column stores
- submit.html and dashboard.html send you to the login page unless you're logged in; logging in opens the dashboard
- The database sets each new project's "author" to the logged-in engineer's username, and only lets them edit their own projects
  (projects without an author can't be edited from the site; to make one editable, type a username into its author cell
   in Supabase > Table Editor > projects)

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

Old Google Sheet (no longer used; its projects were copied into Supabase):
https://docs.google.com/spreadsheets/d/1UK356MwkhS73fkZHGkeQwS_UBx9YpTf9dIunNaGbXLw/edit?gid=0#gid=0


