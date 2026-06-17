import type { Coordinate, PublishedStop } from "@wanderkit/shared";
import { useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, {
  Marker,
  Polyline,
  type LatLng,
  type Region
} from "react-native-maps";

export function TourMap({
  onStopPress,
  route,
  selectedStopId,
  stops
}: {
  onStopPress: (stop: PublishedStop) => void;
  route: Coordinate[];
  selectedStopId?: string | null | undefined;
  stops: PublishedStop[];
}) {
  const mapRef = useRef<MapView | null>(null);
  const routeCoordinates = useMemo(() => route.map(toLatLng), [route]);
  const markerCoordinates = useMemo(
    () =>
      stops.map((stop) => ({
        coordinate: toLatLng(stop.coordinate),
        stop
      })),
    [stops]
  );
  const initialRegion = useMemo(
    () =>
      getInitialRegion([
        ...routeCoordinates,
        ...markerCoordinates.map((item) => item.coordinate)
      ]),
    [markerCoordinates, routeCoordinates]
  );

  const fitRoute = () => {
    const coordinates =
      routeCoordinates.length > 0
        ? routeCoordinates
        : markerCoordinates.map((item) => item.coordinate);

    if (coordinates.length === 0) {
      return;
    }

    mapRef.current?.fitToCoordinates(coordinates, {
      animated: false,
      edgePadding: {
        bottom: 44,
        left: 44,
        right: 44,
        top: 44
      }
    });
  };

  return (
    <View style={styles.mapFrame}>
      <MapView
        initialRegion={initialRegion}
        onMapReady={fitRoute}
        ref={mapRef}
        rotateEnabled={false}
        style={styles.map}
        toolbarEnabled={false}
      >
        <Polyline
          coordinates={routeCoordinates}
          geodesic
          lineCap="round"
          lineJoin="round"
          strokeColor="#2d6a4f"
          strokeWidth={5}
        />

        {markerCoordinates.map(({ coordinate, stop }) => {
          const isSelected = selectedStopId === stop.id;

          return (
            <Marker
              anchor={{ x: 0.5, y: 0.5 }}
              coordinate={coordinate}
              key={stop.id}
              onPress={() => onStopPress(stop)}
            >
              <View style={[styles.pin, isSelected ? styles.pinSelected : null]}>
                <Text style={styles.pinText}>{stop.number}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

function toLatLng(coordinate: Coordinate): LatLng {
  return {
    latitude: coordinate.latitude,
    longitude: coordinate.longitude
  };
}

function getInitialRegion(coordinates: LatLng[]): Region {
  if (coordinates.length === 0) {
    return {
      latitude: 0,
      latitudeDelta: 0.04,
      longitude: 0,
      longitudeDelta: 0.04
    };
  }

  const bounds = coordinates.reduce(
    (currentBounds, coordinate) => ({
      maxLatitude: Math.max(currentBounds.maxLatitude, coordinate.latitude),
      maxLongitude: Math.max(currentBounds.maxLongitude, coordinate.longitude),
      minLatitude: Math.min(currentBounds.minLatitude, coordinate.latitude),
      minLongitude: Math.min(currentBounds.minLongitude, coordinate.longitude)
    }),
    {
      maxLatitude: coordinates[0]?.latitude ?? 0,
      maxLongitude: coordinates[0]?.longitude ?? 0,
      minLatitude: coordinates[0]?.latitude ?? 0,
      minLongitude: coordinates[0]?.longitude ?? 0
    }
  );

  const latitudeDelta = Math.max(
    Math.abs(bounds.maxLatitude - bounds.minLatitude) * 1.8,
    0.01
  );
  const longitudeDelta = Math.max(
    Math.abs(bounds.maxLongitude - bounds.minLongitude) * 1.8,
    0.01
  );

  return {
    latitude: (bounds.maxLatitude + bounds.minLatitude) / 2,
    latitudeDelta,
    longitude: (bounds.maxLongitude + bounds.minLongitude) / 2,
    longitudeDelta
  };
}

const styles = StyleSheet.create({
  mapFrame: {
    backgroundColor: "#eaf4f4",
    borderColor: "#d7ded8",
    borderRadius: 8,
    borderWidth: 1,
    height: 320,
    marginTop: 24,
    overflow: "hidden"
  },
  map: {
    height: "100%",
    width: "100%"
  },
  pin: {
    alignItems: "center",
    backgroundColor: "#c8553d",
    borderColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 3,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  pinSelected: {
    backgroundColor: "#16202a",
    transform: [{ scale: 1.08 }]
  },
  pinText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800"
  }
});
