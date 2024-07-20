
let tab_browser_hpath: zui_handle_t = zui_handle_create();
let tab_browser_hsearch: zui_handle_t = zui_handle_create();
let tab_browser_known: bool = false;
let tab_browser_last_path: string =  "";

function tab_browser_show_directory(directory: string) {
	tab_browser_hpath.text = directory;
	tab_browser_hsearch.text = "";
	ui_base_htabs[tab_area_t.STATUS].position = 0;
}

let _tab_browser_draw_file: string;
let _tab_browser_draw_b: string;

function tab_browser_draw(htab: zui_handle_t) {
	let ui: zui_t = ui_base_ui;
	let statush: i32 = config_raw.layout[layout_size_t.STATUS_H];
	if (zui_tab(htab, tr("Browser")) && statush > ui_status_default_status_h * zui_SCALE(ui)) {

		if (config_raw.bookmarks == null) {
			config_raw.bookmarks = [];
		}

		let bookmarks_w: i32 = math_floor(100 * zui_SCALE(ui));

		if (tab_browser_hpath.text == "" && config_raw.bookmarks.length > 0) { // Init to first bookmark
			tab_browser_hpath.text = config_raw.bookmarks[0];
		}

		zui_begin_sticky();
		let step: f32 = (1.0 - bookmarks_w / ui._w);
		if (tab_browser_hsearch.text != "") {
			let row: f32[] = [bookmarks_w / ui._w, step * 0.73, step * 0.07, step * 0.17, step * 0.03];
			zui_row(row);
		}
		else {
			let row: f32[] = [bookmarks_w / ui._w, step * 0.73, step * 0.07, step * 0.2];
			zui_row(row);
		}

		if (zui_button("+")) {
			array_push(config_raw.bookmarks, tab_browser_hpath.text);
			config_save();
		}
		if (ui.is_hovered) {
			zui_tooltip(tr("Add bookmark"));
		}

		///if krom_android
		let stripped: bool = false;
		let strip: string = "/storage/emulated/0/";
		if (starts_with(tab_browser_hpath.text, strip)) {
			tab_browser_hpath.text = substring(tab_browser_hpath.text, strip.length - 1, tab_browser_hpath.text.length);
			stripped = true;
		}
		///end

		tab_browser_hpath.text = zui_text_input(tab_browser_hpath, tr("Path"));

		///if krom_android
		if (stripped) {
			tab_browser_hpath.text = "/storage/emulated/0" + tab_browser_hpath.text;
		}
		///end

		let refresh: bool = false;
		let in_focus: bool = ui.input_x > ui._window_x && ui.input_x < ui._window_x + ui._window_w &&
							 ui.input_y > ui._window_y && ui.input_y < ui._window_y + ui._window_h;
		if (zui_button(tr("Refresh")) || (in_focus && ui.is_key_pressed && ui.key_code == key_code_t.F5)) {
			refresh = true;
		}
		tab_browser_hsearch.text = zui_text_input(tab_browser_hsearch, tr("Search"), zui_align_t.LEFT, true, true);
		if (ui.is_hovered) {
			zui_tooltip(tr("ctrl+f to search") + "\n" + tr("esc to cancel"));
		}
		if (ui.is_ctrl_down && ui.is_key_pressed && ui.key_code == key_code_t.F) { // Start searching via ctrl+f
			zui_start_text_edit(tab_browser_hsearch);
		}
		if (tab_browser_hsearch.text != "" && (zui_button(tr("X")) || ui.is_escape_down)) {
			tab_browser_hsearch.text = "";
		}
		zui_end_sticky();

		if (tab_browser_last_path != tab_browser_hpath.text) {
			tab_browser_hsearch.text = "";
		}
		tab_browser_last_path = tab_browser_hpath.text;

		let _y: f32 = ui._y;
		ui._x = bookmarks_w;
		ui._w -= bookmarks_w;

		ui_files_file_browser(ui, tab_browser_hpath, false, true, tab_browser_hsearch.text, refresh, function (file: string) {

			let file_name: string = substring(file, string_last_index_of(file, path_sep) + 1, file.length);
			if (file_name == "..") {
				return;
			}

			_tab_browser_draw_file = file;

			// Context menu
			ui_menu_draw(function (ui: zui_t) {
				let file: string = _tab_browser_draw_file;

				if (ui_menu_button(ui, tr("Import"))) {
					import_asset_run(file);
				}
				if (path_is_texture(file)) {
					if (ui_menu_button(ui, tr("Set as Envmap"))) {

						import_asset_run(file, -1.0, -1.0, true, true, function () {
							app_notify_on_next_frame(function () {
								let file: string = _tab_browser_draw_file;

								let asset_index: i32 = -1;
								for (let i: i32 = 0; i < project_assets.length; ++i) {
									if (project_assets[i].file == file) {
										asset_index = i;
										break;
									}
								}
								if (asset_index != -1) {
									import_envmap_run(file, project_get_image(project_assets[asset_index]));
								}
							});
						});
					}

					///if (is_paint || is_sculpt)
					if (ui_menu_button(ui, tr("Set as Mask"))) {
						import_asset_run(file, -1.0, -1.0, true, true, function () {
							app_notify_on_next_frame(function () {
								let file: string = _tab_browser_draw_file;

								let asset_index: i32 = -1;
								for (let i: i32 = 0; i < project_assets.length; ++i) {
									if (project_assets[i].file == file) {
										asset_index = i;
										break;
									}
								}
								if (asset_index != -1) {
									base_create_image_mask(project_assets[asset_index]);
								}
							});
						});
					}
					///end

					///if is_paint
					if (ui_menu_button(ui, tr("Set as Color ID Map"))) {
						import_asset_run(file, -1.0, -1.0, true, true, function () {
							app_notify_on_next_frame(function () {
								let file: string = _tab_browser_draw_file;

								let asset_index: i32 = -1;
								for (let i: i32 = 0; i < project_assets.length; ++i) {
									if (project_assets[i].file == file) {
										asset_index = i;
										break;
									}
								}
								if (asset_index != -1) {
									context_raw.colorid_handle.position = asset_index;
									context_raw.colorid_picked = false;
									ui_toolbar_handle.redraws = 1;
									if (context_raw.tool == workspace_tool_t.COLORID) {
										ui_header_handle.redraws = 2;
										context_raw.ddirty = 2;
									}
								}
							});
						});
					}
					///end
				}
				if (ui_menu_button(ui, tr("Open Externally"))) {
					file_start(file);
				}
			}, path_is_texture(file) ? 5 : 2);
		});

		if (tab_browser_known) {
			let path: string = tab_browser_hpath.text;
			app_notify_on_init(function (path: string) {
				import_asset_run(path);
			}, path);
			tab_browser_hpath.text = substring(tab_browser_hpath.text, 0, string_last_index_of(tab_browser_hpath.text, path_sep));
		}
		let hpath_text: string = tab_browser_hpath.text;
		tab_browser_known = string_index_of(substring(tab_browser_hpath.text, string_last_index_of(tab_browser_hpath.text, path_sep), hpath_text.length), ".") > 0;
		///if krom_android
		if (ends_with(tab_browser_hpath.text, "." + to_lower_case(manifest_title))) {
			tab_browser_known = false;
		}
		///end

		let bottom_y: i32 = ui._y;
		ui._x = 0;
		ui._y = _y;
		ui._w = bookmarks_w;

		if (zui_button(tr("Cloud"), zui_align_t.LEFT)) {
			tab_browser_hpath.text = "cloud";
		}

		if (zui_button(tr("Disk"), zui_align_t.LEFT)) {
			///if krom_android
			ui_menu_draw(function (ui: zui_t) {
				if (ui_menu_button(ui, tr("Download"))) {
					tab_browser_hpath.text = ui_files_default_path;
				}
				if (ui_menu_button(ui, tr("Pictures"))) {
					tab_browser_hpath.text = "/storage/emulated/0/Pictures";
				}
				if (ui_menu_button(ui, tr("Camera"))) {
					tab_browser_hpath.text = "/storage/emulated/0/DCIM/Camera";
				}
				if (ui_menu_button(ui, tr("Projects"))) {
					tab_browser_hpath.text = krom_save_path();
				}
			}, 4);
			///else
			tab_browser_hpath.text = ui_files_default_path;
			///end
		}

		for (let i: i32 = 0; i < config_raw.bookmarks.length; ++i) {
			let b: string = config_raw.bookmarks[i];
			let folder: string = substring(b, string_last_index_of(b, path_sep) + 1, b.length);

			if (zui_button(folder, zui_align_t.LEFT)) {
				tab_browser_hpath.text = b;
			}

			if (ui.is_hovered && ui.input_released_r) {
				_tab_browser_draw_b = b;
				ui_menu_draw(function (ui: zui_t) {
					if (ui_menu_button(ui, tr("Delete"))) {
						array_remove(config_raw.bookmarks, _tab_browser_draw_b);
						config_save();
					}
				}, 1);
			}
		}

		if (ui._y < bottom_y) {
			ui._y = bottom_y;
		}
	}
}
