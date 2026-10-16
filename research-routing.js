// Preserve bookmarks into the former single research page.
(() => {
 const destinations = {
  electrostatics: 'mineral-enrichment.html',
  separation: 'mineral-enrichment.html',
  terrestrial: 'mineral-enrichment.html',
  vibration: 'size-classification.html',
  bne: 'size-classification.html'
 };
 function route() {
  const anchor = location.hash.slice(1);
  if (Object.hasOwn(destinations, anchor)) location.replace(destinations[anchor] + location.hash);
 }
 addEventListener('hashchange', route);
 route();
})();
