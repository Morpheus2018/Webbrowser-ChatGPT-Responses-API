const settingsBtn = document.getElementById("settingsBtn");
const settingsMenu = document.getElementById("settingsMenu");

settingsBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  settingsMenu.classList.toggle("show");
});

// schließen wenn außerhalb geklickt wird
document.addEventListener("click", () => {
  settingsMenu.classList.remove("show");
});

// Menü schließen wenn ein Menübutton geklickt wird
settingsMenu.addEventListener("click", (e) => {

  e.stopPropagation();

  const btn = e.target.closest("button");

  if (btn) {
    settingsMenu.classList.remove("show");
  }

});

/* FIX für Settings Button */
const menuSettingsBtn = document.getElementById("menuSettingsBtn");

if (menuSettingsBtn) {
  menuSettingsBtn.addEventListener("click", () => {
    settingsMenu.classList.remove("show");
  });
}
