package jtslab;

import org.locationtech.jts.geom.*;
import org.locationtech.jts.io.WKTWriter;

public class GeometryExample {
    public static void main(String[] args) {
        GeometryFactory factory = new GeometryFactory();

        // Point 2개 생성
        Point p1 = factory.createPoint(new Coordinate(1, 1));
        Point p2 = factory.createPoint(new Coordinate(2, 2));
        System.out.println("Point1: " + p1);
        System.out.println("Point2: " + p2);
        System.out.println("Distance: " + p1.distance(p2));

        // Line 생성
        LineString line = factory.createLineString(new Coordinate[]{
                new Coordinate(0, 0),
                new Coordinate(3, 3)
        });
        System.out.println("Line: " + line);

        // Buffer 생성
        Geometry buffer = p1.buffer(1.0);
        System.out.println("Buffer: " + new WKTWriter().write(buffer));
    }
}
