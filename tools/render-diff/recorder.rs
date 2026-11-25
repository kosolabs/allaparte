//! Copied into the engine to save what each layout in its tests draws.

use crate::model::Score;
use crate::render::svg::{display_list_to_svg_pages, SvgExportConfig};
use crate::render::DisplayList;
use std::{
    cell::{Cell, RefCell},
    collections::{hash_map::DefaultHasher, HashMap},
    ffi::OsString,
    fs::{self, File, OpenOptions},
    hash::{Hash, Hasher},
    io::Write,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    thread,
};

const MM_PER_UNIT: f64 = 25.4 / 96.0;

thread_local! {
    static DEPTH: Cell<usize> = const { Cell::new(0) };
    static COUNT: Cell<usize> = const { Cell::new(0) };
    static PARSED: RefCell<HashMap<String, String>> = RefCell::default();
}

pub fn parse<E>(mnx: String, parse: impl FnOnce() -> Result<Score, E>) -> Result<Score, E> {
    let score = parse()?;
    PARSED.with_borrow_mut(|parsed| parsed.insert(write(&score), mnx));
    Ok(score)
}

pub fn layout(score: &Score, layout: impl FnOnce() -> DisplayList) -> DisplayList {
    DEPTH.set(DEPTH.get() + 1);
    let list = layout();
    DEPTH.set(DEPTH.get() - 1);
    if DEPTH.get() == 0 {
        COUNT.set(COUNT.get() + 1);
        save(score, &list);
    }
    list
}

fn save(score: &Score, list: &DisplayList) {
    let thread = thread::current();
    let entry = serde_json::json!({
        "test": thread.name().unwrap_or("unnamed thread"),
        "call": COUNT.get(),
        "mnx": store(&original(score), "mnx"),
        "pages": svgs(list).iter().map(|svg| store(svg, "svg")).collect::<Vec<_>>(),
    });
    writeln!(manifest().lock().unwrap(), "{entry}").unwrap();
}

/// The MNX the test parsed, or the engine's own if the test changed the score.
fn original(score: &Score) -> String {
    let written = write(score);
    PARSED.with_borrow(|parsed| parsed.get(&written).cloned().unwrap_or(written))
}

fn write(score: &Score) -> String {
    serde_json::to_string(score).unwrap()
}

fn svgs(list: &DisplayList) -> Vec<String> {
    static FONTS: OnceLock<(Vec<u8>, Vec<u8>)> = OnceLock::new();
    let (music, text) = FONTS.get_or_init(|| {
        let fonts = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../assets/fonts");
        let font = |name| fs::read(fonts.join(name)).unwrap();
        (font("Bravura.otf"), font("LibertinusSerif-Regular.otf"))
    });
    let height = list.pages.first().map_or(list.height, |page| page.height);
    let config = SvgExportConfig {
        spatium_mm: MM_PER_UNIT,
        sp_pixels: 1.0,
        page_width_mm: list.width * MM_PER_UNIT,
        page_height_mm: height * MM_PER_UNIT,
    };
    let pages = display_list_to_svg_pages(list, music, Some(text), &config).unwrap();
    pages.into_iter().map(|page| page.svg).collect()
}

fn store(content: &str, extension: &str) -> String {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    let name = format!("{:016x}.{extension}", hasher.finish());
    let path = PathBuf::from(env("RECORDER_PICTURES")).join(&name);
    if !path.exists() {
        let unfinished = path.with_extension(format!("{:?}", thread::current().id()));
        fs::write(&unfinished, content).unwrap();
        fs::rename(unfinished, path).unwrap();
    }
    name
}

fn manifest() -> &'static Mutex<File> {
    static MANIFEST: OnceLock<Mutex<File>> = OnceLock::new();
    MANIFEST.get_or_init(|| {
        let mut options = OpenOptions::new();
        let path = env("RECORDER_MANIFEST");
        Mutex::new(options.create(true).append(true).open(path).unwrap())
    })
}

fn env(name: &str) -> OsString {
    std::env::var_os(name).unwrap()
}
