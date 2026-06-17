import type { Coordinate, PublishedStop } from "@wanderkit/shared";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type PositionedStop = {
  left: `${number}%`;
  stop: PublishedStop;
  top: `${number}%`;
};

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
  const positionedStops = useMemo(() => getPositionedStops(stops), [stops]);

  return (
    <View style={styles.mapFrame}>
      <View style={styles.routeLine} />
      <View style={styles.routeMeta}>
        <Text style={styles.routeTitle}>Route preview</Text>
        <Text style={styles.routeBody}>
          {route.length} route points - {stops.length} stops
        </Text>
      </View>

      {positionedStops.map(({ left, stop, top }) => {
        const isSelected = selectedStopId === stop.id;

        return (
          <Pressable
            accessibilityLabel={`Open stop ${stop.number}: ${stop.title}`}
            key={stop.id}
            onPress={() => onStopPress(stop)}
            style={[
              styles.pin,
              { left, top },
              isSelected ? styles.pinSelected : null
            ]}
          >
            <Text style={styles.pinText}>{stop.number}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function getPositionedStops(stops: PublishedStop[]): PositionedStop[] {
  if (stops.length === 0) {
    return [];
  }

  const bounds = stops.reduce(
    (currentBounds, stop) => ({
      maxLatitude: Math.max(
        currentBounds.maxLatitude,
        stop.coordinate.latitude
      ),
      maxLongitude: Math.max(
        currentBounds.maxLongitude,
        stop.coordinate.longitude
      ),
      minLatitude: Math.min(
        currentBounds.minLatitude,
        stop.coordinate.latitude
      ),
      minLongitude: Math.min(
        currentBounds.minLongitude,
        stop.coordinate.longitude
      )
    }),
    {
      maxLatitude: stops[0]?.coordinate.latitude ?? 0,
      maxLongitude: stops[0]?.coordinate.longitude ?? 0,
      minLatitude: stops[0]?.coordinate.latitude ?? 0,
      minLongitude: stops[0]?.coordinate.longitude ?? 0
    }
  );

  const latitudeRange = Math.max(
    bounds.maxLatitude - bounds.minLatitude,
    0.000001
  );
  const longitudeRange = Math.max(
    bounds.maxLongitude - bounds.minLongitude,
    0.000001
  );

  return stops.map((stop) => ({
    stop,
    left: `${clamp(
      14 +
        ((stop.coordinate.longitude - bounds.minLongitude) / longitudeRange) *
          72,
      8,
      86
    )}%`,
    top: `${clamp(
      14 +
        ((bounds.maxLatitude - stop.coordinate.latitude) / latitudeRange) *
          72,
      8,
      86
    )}%`
  }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const styles = StyleSheet.create({
  mapFrame: {
    backgroundColor: "#eaf4f4",
    borderColor: "#d7ded8",
    borderRadius: 8,
    borderWidth: 1,
    height: 320,
    marginTop: 24,
    overflow: "hidden",
    position: "relative"
  },
  routeLine: {
    backgroundColor: "#2d6a4f",
    borderRadius: 999,
    height: 5,
    left: "16%",
    opacity: 0.55,
    position: "absolute",
    right: "16%",
    top: "50%"
  },
  routeMeta: {
    backgroundColor: "rgba(255, 255, 255, 0.88)",
    borderColor: "#d7ded8",
    borderRadius: 8,
    borderWidth: 1,
    left: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    position: "absolute",
    right: 16,
    top: 16
  },
  routeTitle: {
    color: "#16202a",
    fontSize: 14,
    fontWeight: "800"
  },
  routeBody: {
    color: "#53615a",
    fontSize: 13,
    marginTop: 2
  },
  pin: {
    alignItems: "center",
    backgroundColor: "#c8553d",
    borderColor: "#ffffff",
    borderRadius: 18,
    borderWidth: 3,
    height: 36,
    justifyContent: "center",
    marginLeft: -18,
    marginTop: -18,
    position: "absolute",
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
