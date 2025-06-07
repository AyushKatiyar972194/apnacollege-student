// Initialize map when the window loads
window.addEventListener('load', function() {
    // Validate required variables
    if (!window.mapToken || typeof window.mapToken !== 'string' || !window.mapToken.trim()) {
        console.error('MapBox token is not properly defined:', {
            exists: !!window.mapToken,
            type: typeof window.mapToken,
            isEmpty: !window.mapToken?.trim()
        });
        showMapError('Map configuration error - token not available');
        return;
    }

    if (!window.listing?.geometry?.coordinates) {
        console.error('Listing coordinates are not properly defined:', {
            hasListing: !!window.listing,
            hasGeometry: !!window.listing?.geometry,
            coordinates: window.listing?.geometry?.coordinates
        });
        showMapError('Map configuration error - coordinates not available');
        return;
    }

    try {
        // Initialize Mapbox
        mapboxgl.accessToken = window.mapToken.trim();
        const map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/mapbox/streets-v11',
            center: window.listing.geometry.coordinates,
            zoom: 10
        });

        // Add marker
        new mapboxgl.Marker({color: 'red'})
            .setLngLat(window.listing.geometry.coordinates)
            .setPopup(
                new mapboxgl.Popup({offset: 25})
                    .setHTML(`<h4>${window.listing.location}</h4><p>Exact Location will be provided after booking</p>`)
            )
            .addTo(map);

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // Store map instance globally for the sidebar toggle
        window.mapInstance = map;

        // Add load event handler
        map.on('load', function() {
            console.log('Map loaded successfully');
        });

    } catch (error) {
        console.error('Error initializing map:', error);
        showMapError(error.message);
    }
});

// Helper function to show map errors
function showMapError(message) {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div class="alert alert-warning" style="margin: 20px;">
                <h5>Map temporarily unavailable</h5>
                <p>${message}</p>
                <p>Location: ${window.listing?.location || 'Not specified'}</p>
            </div>
        `;
    }
}

// Sidebar toggle function
function toggleSidebar(id) {
    try {
        const elem = document.getElementById(id);
        if (!elem) return;

        const collapsed = elem.classList.toggle('collapsed');
        const padding = {};
        padding[id] = collapsed ? 0 : 300;

        if (window.mapInstance) {
            window.mapInstance.easeTo({
                padding: padding,
                duration: 1000
            });
        }
    } catch (error) {
        console.error('Error toggling sidebar:', error);
    }
}

    