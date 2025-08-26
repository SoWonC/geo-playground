package com.example.postgis_demo.service;

import com.example.postgis_demo.dto.SpatialDTO;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.*;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;

@Service
public class SpecialService {

    @Autowired
    private DataSource dataSource;

    // 1. 데이터 조회
    public List<SpatialDTO> fetchSpatialData() {
        String sql = "SELECT id, name, ST_AsText(geom) AS wkt, ST_Area(geom::geography) AS area_m2 FROM spatial_table";
        List<SpatialDTO> results = new ArrayList<>();

        try (
                Connection conn = dataSource.getConnection();
                PreparedStatement ps = conn.prepareStatement(sql);
                ResultSet rs = ps.executeQuery()
        ) {
            while (rs.next()) {
                SpatialDTO dto = new SpatialDTO();
                dto.setId(rs.getLong("id"));
                dto.setName(rs.getString("name"));
                dto.setWkt(rs.getString("wkt"));
                dto.setArea(rs.getDouble("area_m2"));
                results.add(dto);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        return results;
    }

    // 2. TXT 파일로 저장
    public void saveToTxt(List<SpatialDTO> data, String filePath) {
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(filePath))) {
            for (SpatialDTO dto : data) {
                writer.write(dto.getId() + "\t" + dto.getName() + "\t" + dto.getWkt() + "\t" + dto.getArea());
                writer.newLine();
            }
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    // 3. Excel로 저장
    public void saveToExcel(List<SpatialDTO> data, String filePath) {
        Workbook workbook = new XSSFWorkbook();
        Sheet sheet = workbook.createSheet("Spatial Data");

        // 헤더
        Row header = sheet.createRow(0);
        header.createCell(0).setCellValue("ID");
        header.createCell(1).setCellValue("Name");
        header.createCell(2).setCellValue("WKT");
        header.createCell(3).setCellValue("Area (㎡)");

        // 데이터 행
        int rowNum = 1;
        for (SpatialDTO dto : data) {
            Row row = sheet.createRow(rowNum++);
            row.createCell(0).setCellValue(dto.getId());
            row.createCell(1).setCellValue(dto.getName());
            row.createCell(2).setCellValue(dto.getWkt());
            row.createCell(3).setCellValue(dto.getArea());
        }

        // 저장
        try (FileOutputStream out = new FileOutputStream(filePath)) {
            workbook.write(out);
            workbook.close();
        } catch (IOException e) {
            e.printStackTrace();
        }
    }
}
