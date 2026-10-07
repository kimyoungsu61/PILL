package com.pill.web;

import org.springframework.stereotype.Controller;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.Map;

@Controller
public class WebAppController {
    private final JdbcTemplate db;
    public WebAppController(JdbcTemplate db) { this.db=db; }
    @GetMapping("/") public String app() { return "forward:/index.html"; }
    @GetMapping(value="/manifest.webmanifest",produces="application/manifest+json")
    @ResponseBody public ResponseEntity<Resource> manifest() {
        return ResponseEntity.ok().contentType(MediaType.valueOf("application/manifest+json"))
            .body(new ClassPathResource("static/manifest.webmanifest"));
    }
    @GetMapping("/healthz") @ResponseBody public Map<String,String> health() {
        db.queryForObject("SELECT 1",Integer.class);return Map.of("status","ok");
    }
}
