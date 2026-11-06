//! Weather for the after-work picks (M5), from Open-Meteo: free, no key, no account.
//! Only the city name the user typed is sent (to geocode it); results are cached for 30 minutes.

use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;

const GEO: &str = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST: &str = "https://api.open-meteo.com/v1/forecast";
const TTL: Duration = Duration::from_secs(30 * 60);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Place {
    pub name: String,
    pub country: String,
    /// ISO code, e.g. "CN" — decides which sites the links go to
    pub country_code: String,
    pub lat: f64,
    pub lon: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Weather {
    pub place: Place,
    pub temp: f64,
    pub feels: f64,
    /// WMO weather code
    pub code: i64,
    /// highest chance of rain over the next 6 hours, 0–100
    pub rain_chance: i64,
    pub precipitation: f64,
    pub wind: f64,
    pub is_day: bool,
}

static CACHE: Mutex<Option<(String, Instant, Weather)>> = Mutex::new(None);

/// "上海市" → "上海"; geocoding knows cities by their short name
pub fn clean_city(city: &str) -> String {
    let c = city.trim();
    let c = c.strip_suffix('市').filter(|s| s.chars().count() >= 2).unwrap_or(c);
    c.chars().take(60).collect()
}

pub fn parse_place(v: &Value) -> Option<Place> {
    let r = v.get("results")?.get(0)?;
    Some(Place {
        name: r.get("name")?.as_str()?.to_string(),
        country: r.get("country").and_then(Value::as_str).unwrap_or("").to_string(),
        country_code: r.get("country_code").and_then(Value::as_str).unwrap_or("").to_string(),
        lat: r.get("latitude")?.as_f64()?,
        lon: r.get("longitude")?.as_f64()?,
    })
}

pub fn parse_weather(place: Place, v: &Value) -> Option<Weather> {
    let c = v.get("current")?;
    let f = |k: &str| c.get(k).and_then(Value::as_f64);
    let rain_chance = v
        .pointer("/hourly/precipitation_probability")
        .and_then(Value::as_array)
        .map(|a| a.iter().filter_map(Value::as_i64).max().unwrap_or(0))
        .unwrap_or(0);
    Some(Weather {
        place,
        temp: f("temperature_2m")?,
        feels: f("apparent_temperature").or(f("temperature_2m"))?,
        code: c.get("weather_code").and_then(Value::as_i64).unwrap_or(0),
        rain_chance,
        precipitation: f("precipitation").unwrap_or(0.0),
        wind: f("wind_speed_10m").unwrap_or(0.0),
        is_day: c.get("is_day").and_then(Value::as_i64).unwrap_or(1) == 1,
    })
}

async fn get_json(c: &reqwest::Client, url: &str, q: &[(&str, String)]) -> Result<Value, String> {
    let r = c.get(url).query(q).send().await.map_err(|_| "unreachable".to_string())?;
    if !r.status().is_success() {
        return Err(format!("http {}", r.status().as_u16()));
    }
    r.json().await.map_err(|e| e.to_string())
}

pub async fn now(city: &str, lang: &str) -> Result<Weather, String> {
    let city = clean_city(city);
    if city.is_empty() {
        return Err("nocity".into());
    }
    let key = format!("{lang}:{city}");
    if let Some((k, at, w)) = CACHE.lock().unwrap().as_ref() {
        if *k == key && at.elapsed() < TTL {
            return Ok(w.clone());
        }
    }
    let c = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(8))
        .timeout(Duration::from_secs(15))
        .build()
        .map_err(|e| e.to_string())?;
    let lang = if lang.starts_with("zh") { "zh" } else { "en" };
    let geo = get_json(&c, GEO, &[("name", city.clone()), ("count", "1".into()), ("language", lang.into()), ("format", "json".into())]).await?;
    let place = parse_place(&geo).ok_or("notfound")?;
    let fc = get_json(
        &c,
        FORECAST,
        &[
            ("latitude", place.lat.to_string()),
            ("longitude", place.lon.to_string()),
            ("current", "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day".into()),
            ("hourly", "precipitation_probability".into()),
            ("forecast_hours", "6".into()),
            ("timezone", "auto".into()),
        ],
    )
    .await?;
    let w = parse_weather(place, &fc).ok_or("badweather")?;
    *CACHE.lock().unwrap() = Some((key, Instant::now(), w.clone()));
    Ok(w)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn cleans_and_parses() {
        assert_eq!(clean_city(" 上海市 "), "上海");
        assert_eq!(clean_city("市"), "市");
        assert_eq!(clean_city("London"), "London");
        let p = parse_place(&json!({"results":[{"name":"上海","country":"中国","country_code":"CN","latitude":31.2,"longitude":121.4}]})).unwrap();
        assert_eq!(p.country_code, "CN");
        assert!(parse_place(&json!({"generationtime_ms": 1})).is_none());
        let w = parse_weather(p, &json!({
            "current": {"temperature_2m": 19.0, "apparent_temperature": 18.3, "precipitation": 0.0, "weather_code": 61, "wind_speed_10m": 7.8, "is_day": 0},
            "hourly": {"precipitation_probability": [10, 70, null, 40]}
        }))
        .unwrap();
        assert_eq!((w.code, w.rain_chance, w.is_day), (61, 70, false));
    }

    /// hits the real Open-Meteo API: `cargo test -- --ignored live_weather`
    #[test]
    #[ignore]
    fn live_weather() {
        let w = tauri::async_runtime::block_on(now("杭州市", "zh")).unwrap();
        assert_eq!(w.place.country_code, "CN");
        println!("{w:?}");
    }
}
