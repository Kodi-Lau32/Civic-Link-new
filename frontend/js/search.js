// Search popup. Only runs on pages whose navbar has data-search (load after nav.js).

function initSearchPopup() {
  const openSearch = document.getElementById("openSearch");
  if (!openSearch) return;

  const popup = document.createElement("div");
  popup.className = "popup-overlay";
  popup.id = "popup";
  popup.innerHTML = `
    <div class="popup-box">
      <input type="text" class="search-input" placeholder="Type to search...">
      <button class="close-btn" id="closePopup">&times;</button>
    </div>
  `;
  document.body.appendChild(popup);

  const searchInput = popup.querySelector(".search-input");
  const closePopup = () => { popup.style.display = "none"; };

  openSearch.addEventListener("click", () => {
    popup.style.display = "flex";
    searchInput.focus();
  });
  popup.querySelector(".close-btn").addEventListener("click", closePopup);

  // close when clicking outside the box
  popup.addEventListener("click", (e) => {
    if (e.target === popup) closePopup();
  });
}

initSearchPopup();
