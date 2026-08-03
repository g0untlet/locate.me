# Functional Scope: locate.me

## 1. Functional Areas

### 1.1. User Management
- The application supports multiple users, identified by a `userId`.
- The `userId` is stored in the browser's local storage.
- A default `userId` of "user123" is used if none is set.
- The backend validates the `userId` against a list of allowed users.

### 1.2. Geolocation
- The application can fetch the user's current geographical coordinates (latitude and longitude).
- The coordinates are used to display the user's location on a map.
- The coordinates are also used to fetch weather and address information.

### 1.3. Location History
- Users can save their current location.
- Saved locations are stored in a history.
- The history can be viewed as a list or on a map.
- Users can delete locations from their history.

### 1.4. Weather Information
- For a given location, the application fetches and displays the current temperature and weather conditions.
- This is done by an external API (Open-Meteo).

### 1.5. Geocoding
- For a given location, the application fetches and displays the corresponding address.
- This is done by an external API (OpenStreetMap/Nominatim).

## 2. User Interface

The application is a single-page application (SPA) with three main views:

### 2.1. Locate View
- This is the main view of the application.
- It displays a button to fetch the current location.
- When the location is fetched, it is displayed on a map.
- The view also shows the current weather and address information.
- A "Save Location" button allows the user to save the current location to their history.

### 2.2. History View
- This view displays the user's saved locations.
- It has two modes: a list view and a map view.
- The list view shows a chronological list of saved locations.
- The map view shows all saved locations as markers on a map.
- Each location in the list can be deleted.

### 2.3. Settings View
- This view allows the user to configure the application.
- The user can set their `userId`.
- The user can toggle between light and dark mode.
- The view also displays the application version and links to the used services (OpenStreetMap, Leaflet, Open-Meteo).

## 3. Backend Services

The backend provides a REST API with the following endpoints:

- `POST /positions?userId={userId}`: Creates a new position for a user. The position data is in the request body as JSON.
- `DELETE /positions/{id}?userId={userId}`: Deletes a position by its ID.
- `GET /positions?userId={userId}&lat={lat}&lon={lon}`: Retrieves all positions for a user. If `lat` and `lon` are provided, it also calculates the distance and walking time to each position.
- `GET /positions/current?userId={userId}&lat={lat}&lon={lon}`: Creates a new position with the given coordinates and returns it. This is used to get weather and geocoding information for the current location.

## 4. Business Objects

The main business object is the `Position` entity, which has the following attributes:

- `id`: The primary key.
- `userId`: The user who owns this position.
- `latitude`, `longitude`: The coordinates of the position.
- `accuracy`: The accuracy of the coordinates.
- `displayName`: A human-readable name for the position.
- `temperature`, `weatherCode`: Weather information.
- `timestamp`: When the position was recorded.
- `osmCategory`, `osmType`, `osmName`, `addressType`, `houseNumber`, `road`, `city`, `country`: Geocoding information from OpenStreetMap.
- `tag`: A tag for the position (e.g., "home", "work").
- `comment`: A user-provided comment.
