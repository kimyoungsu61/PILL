package com.pill.garden;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import static org.assertj.core.api.Assertions.*;

class GardenSchemaTest {
    @Test void productionSchemaCanRunTwiceAndEnforcesOneStampPerUserAndDay() {
        var source = new DriverManagerDataSource("jdbc:h2:mem:garden-schema-" + UUID.randomUUID()
            + ";MODE=MySQL;DATABASE_TO_UPPER=false;DB_CLOSE_DELAY=-1", "sa", "");
        var schema = new ResourceDatabasePopulator(new ClassPathResource("db/schema_mysql.sql"));
        schema.execute(source);
        schema.execute(source);
        var db = new JdbcTemplate(source);
        db.update("INSERT INTO users(id,email,password_hash) VALUES(1,'schema@example.test','hash')");
        db.update("INSERT INTO garden_day(user_id,stamp_date,earned,completion_keys) VALUES(1,'2026-10-20',TRUE,'1|09:00')");
        db.update("INSERT INTO garden_style(user_id,pot,stamp) VALUES(1,'clay','leaf')");
        assertThat(db.queryForObject("SELECT COUNT(*) FROM garden_day WHERE earned=TRUE", Integer.class)).isEqualTo(1);
        assertThatThrownBy(() -> db.update("INSERT INTO garden_day(user_id,stamp_date,earned,completion_keys) VALUES(1,'2026-10-20',TRUE,'1|09:00')"))
            .isInstanceOf(DataIntegrityViolationException.class);
    }
}
