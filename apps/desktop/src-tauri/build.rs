use std::env;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const PNG_SIGNATURE: [u8; 8] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

struct PngMetadata {
  width: u32,
  height: u32,
  bit_depth: u8,
  color_type: u8,
}

fn main() {
  if let Err(error) = sync_windows_icon() {
    panic!("{error}");
  }

  tauri_build::build()
}

fn sync_windows_icon() -> Result<(), String> {
  println!("cargo:rerun-if-changed=icons/icon.png");

  let manifest_dir = PathBuf::from(
    env::var("CARGO_MANIFEST_DIR")
      .map_err(|error| format!("Unable to resolve CARGO_MANIFEST_DIR: {error}"))?,
  );
  let icon_png_path = manifest_dir.join("icons").join("icon.png");
  let icon_ico_path = manifest_dir.join("icons").join("icon.ico");

  let png_bytes = fs::read(&icon_png_path)
    .map_err(|error| format!("Unable to read {}: {error}", icon_png_path.display()))?;
  let metadata = read_png_metadata(&png_bytes, &icon_png_path)?;

  if metadata.width != metadata.height {
    return Err(format!(
      "{} must be square, got {}x{}.",
      icon_png_path.display(),
      metadata.width,
      metadata.height
    ));
  }

  if metadata.bit_depth != 8 || metadata.color_type != 6 {
    return Err(format!(
      "{} must be RGBA 32-bit for Tauri icon generation, got color_type={} bit_depth={}.",
      icon_png_path.display(),
      metadata.color_type,
      metadata.bit_depth
    ));
  }

  let ico_bytes = build_ico_from_png(&png_bytes, metadata.width, metadata.height);
  let should_write = match fs::read(&icon_ico_path) {
    Ok(existing) => existing != ico_bytes,
    Err(error) if error.kind() == io::ErrorKind::NotFound => true,
    Err(error) => {
      return Err(format!(
        "Unable to read existing {}: {error}",
        icon_ico_path.display()
      ))
    }
  };

  if should_write {
    fs::write(&icon_ico_path, ico_bytes)
      .map_err(|error| format!("Unable to write {}: {error}", icon_ico_path.display()))?;
  }

  Ok(())
}

fn read_png_metadata(bytes: &[u8], path: &Path) -> Result<PngMetadata, String> {
  if bytes.len() < 26 {
    return Err(format!("{} is too small to be a valid PNG.", path.display()));
  }

  if bytes[..8] != PNG_SIGNATURE {
    return Err(format!("{} is not a valid PNG file.", path.display()));
  }

  let width = u32::from_be_bytes([bytes[16], bytes[17], bytes[18], bytes[19]]);
  let height = u32::from_be_bytes([bytes[20], bytes[21], bytes[22], bytes[23]]);

  Ok(PngMetadata {
    width,
    height,
    bit_depth: bytes[24],
    color_type: bytes[25],
  })
}

fn build_ico_from_png(png_bytes: &[u8], width: u32, height: u32) -> Vec<u8> {
  let mut ico = Vec::with_capacity(22 + png_bytes.len());

  ico.extend_from_slice(&0u16.to_le_bytes());
  ico.extend_from_slice(&1u16.to_le_bytes());
  ico.extend_from_slice(&1u16.to_le_bytes());
  ico.push(encode_ico_dimension(width));
  ico.push(encode_ico_dimension(height));
  ico.push(0);
  ico.push(0);
  ico.extend_from_slice(&1u16.to_le_bytes());
  ico.extend_from_slice(&32u16.to_le_bytes());
  ico.extend_from_slice(&(png_bytes.len() as u32).to_le_bytes());
  ico.extend_from_slice(&22u32.to_le_bytes());
  ico.extend_from_slice(png_bytes);

  ico
}

fn encode_ico_dimension(value: u32) -> u8 {
  match value {
    0 => 0,
    1..=255 => value as u8,
    _ => 0,
  }
}
