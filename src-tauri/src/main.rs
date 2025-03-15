// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
use std::fs;
use serde_json::json;

// The app config directory setup will happen in the tauri::Builder setup handler
fn main() {
    mlface_lib::run()
}
