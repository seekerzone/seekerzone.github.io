// Function to get query parameter by name
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function onMapClick(e) { 
    const latLng = e.latlng;
    const coordinates = `${latLng.lat.toFixed(5)},${latLng.lng.toFixed(5)}`;

    // Copy coordinates to clipboard
    navigator.clipboard.writeText(coordinates)
        .then(() => {
          popup
           .setLatLng(latLng)
           .setContent(`Coordinates copied: ${latLng.lat.toFixed(5)},${latLng.lng.toFixed(5)}`)
           .openOn(map);
        })
        .catch(err => {
            alert("Failed to copy coordinates: " + err);
        });
   }