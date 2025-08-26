package com.example.postgis_demo.dto;

import lombok.Data;


@Data
public class SpatialDTO {
    private Long id;
    private String name;
    private String wkt;
    private Double area;
}

