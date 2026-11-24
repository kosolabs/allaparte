use std::{env, error::Error, fs, path::Path};
use viritura_engine::{
    layout::{layout_full_score, layout_with_mnx_scores, LayoutConfig},
    parse::parse_mnx,
    reconcile::reconcile_score,
    render::svg::{display_list_to_svg_pages, SvgExportConfig},
};

const FONTS: &str = concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../vendor/viritura/assets/fonts"
);
const MM_PER_UNIT: f64 = 25.4 / 96.0;
const PAGE_WIDTH: f64 = 816.0;

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = env::args().skip(1);
    let input = args
        .next()
        .ok_or("Usage: pnpm render <score.mnx> [score index]")?;
    let index = args.next().map_or(Ok(0), |arg| arg.parse())?;
    let mut score = parse_mnx(&fs::read_to_string(&input)?).map_err(|e| format!("{e:?}"))?;
    reconcile_score(&mut score);

    let mut config = LayoutConfig::default();
    let list = if score.scores.is_empty() {
        layout_full_score(&score, &config)
    } else {
        config.page_width = Some(PAGE_WIDTH);
        layout_with_mnx_scores(&score, &config, index)
    };
    let height = list.pages.first().map_or(list.height, |page| page.height);
    let svg = SvgExportConfig {
        spatium_mm: MM_PER_UNIT,
        sp_pixels: 1.0,
        page_width_mm: list.width * MM_PER_UNIT,
        page_height_mm: height * MM_PER_UNIT,
    };
    let music = fs::read(format!("{FONTS}/Bravura.otf"))?;
    let text = fs::read(format!("{FONTS}/LibertinusSerif-Regular.otf"))?;
    for page in display_list_to_svg_pages(&list, &music, Some(&text), &svg)? {
        let output = Path::new(&input).with_extension(format!("{}.svg", page.page_number));
        fs::write(&output, page.svg)?;
        println!("{}", output.display());
    }
    Ok(())
}
