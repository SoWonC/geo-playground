package com.example.postgis_demo;

import com.example.postgis_demo.dto.SpatialDTO;
import com.example.postgis_demo.service.SpecialService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

import java.util.List;

@SpringBootApplication
public class PostgisDemoApplication implements CommandLineRunner {

	@Autowired
	private SpecialService specialService;

	public static void main(String[] args) {
		SpringApplication.run(PostgisDemoApplication.class, args);
	}

	@Override
	public void run(String... args) {
		List<SpatialDTO> data = specialService.fetchSpatialData();

		specialService.saveToTxt(data, "output.txt");
		specialService.saveToExcel(data, "output.xlsx");

		System.out.println("파일 출력 완료");
	}
}
