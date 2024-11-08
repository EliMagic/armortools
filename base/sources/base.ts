
let base_ui_enabled: bool = true;
let base_is_dragging: bool = false;
let base_is_resizing: bool = false;
let base_drag_asset: asset_t = null;
let base_drag_swatch: swatch_color_t = null;
let base_drag_file: string = null;
let base_drag_file_icon: image_t = null;
let base_drag_tint: i32 = 0xffffffff;
let base_drag_size: i32 = -1;
let base_drag_rect: rect_t = null;
let base_drag_off_x: f32 = 0.0;
let base_drag_off_y: f32 = 0.0;
let base_drag_start: f32 = 0.0;
let base_drop_x: f32 = 0.0;
let base_drop_y: f32 = 0.0;
let base_font: g2_font_t = null;
let base_theme: ui_theme_t;
let base_color_wheel: image_t;
let base_color_wheel_gradient: image_t;
let base_ui_box: ui_t;
let base_ui_menu: ui_t;
let base_default_element_w: i32 = 100;
let base_default_element_h: i32 = 28;
let base_default_font_size: i32 = 13;
let base_res_handle: ui_handle_t = ui_handle_create();
let base_bits_handle: ui_handle_t = ui_handle_create();
let base_drop_paths: string[] = [];
let base_appx: i32 = 0;
let base_appy: i32 = 0;
let base_last_window_width: i32 = 0;
let base_last_window_height: i32 = 0;
let base_drag_material: slot_material_t = null;
let base_drag_layer: slot_layer_t = null;

let base_temp_image: image_t = null;
let base_expa: image_t = null;
let base_expb: image_t = null;
let base_expc: image_t = null;

let base_default_fov: f32 = 0.69;
let base_default_base: f32 = 0.5;
let base_default_rough: f32 = 0.4;
let base_max_layers: i32 =
///if (arm_android || arm_ios)
	18;
///else
	255;
///end

let _base_material_count: i32;
let _base_uv_type: uv_type_t;
let _base_decal_mat: mat4_t;
let _base_position: i32;
let _base_base_color: i32;
let _base_occlusion: f32;
let _base_roughness: f32;
let _base_metallic: f32;

function base_init() {
	base_last_window_width = sys_width();
	base_last_window_height = sys_height();

	sys_notify_on_drop_files(function (drop_path: string) {
		///if arm_linux
		drop_path = uri_decode(drop_path);
		///end
		drop_path = trim_end(drop_path);
		array_push(base_drop_paths, drop_path);
	});

	sys_notify_on_app_state(
		function () { // Foreground
			context_raw.foreground_event = true;
			context_raw.last_paint_x = -1;
			context_raw.last_paint_y = -1;
		},
		function () {}, // Resume
		function () {}, // Pause
		function () { // Background
			// Release keys after alt-tab / win-tab
			keyboard_up_listener(key_code_t.ALT);
			keyboard_up_listener(key_code_t.WIN);
		},
		function () { // Shutdown
			///if (arm_android || arm_ios)
			project_save();
			///end
		}
	);

	iron_set_save_and_quit_callback(base_save_and_quit_callback);

	let font: g2_font_t = data_get_font("font.ttf");
	let image_color_wheel: image_t = data_get_image("color_wheel.k");
	let image_color_wheel_gradient: image_t = data_get_image("color_wheel_gradient.k");

	base_font = font;
	config_load_theme(config_raw.theme, false);
	base_default_element_w = base_theme.ELEMENT_W;
	base_default_element_h = base_theme.ELEMENT_H;
	base_default_font_size = base_theme.FONT_SIZE;
	translator_load_translations(config_raw.locale);
	ui_files_filename = tr("untitled");
	///if (arm_android || arm_ios)
	sys_title_set(tr("untitled"));
	///end

	// Baked font for fast startup
	if (config_raw.locale == "en") {
		base_font.font_ = iron_g2_font_13(base_font.blob);
		base_font.glyphs = _g2_font_glyphs;
	}
	else {
		g2_font_init(base_font);
	}

	base_color_wheel = image_color_wheel;
	base_color_wheel_gradient = image_color_wheel_gradient;
	ui_nodes_enum_texts = base_enum_texts;
	let ops: ui_options_t = {
		theme: base_theme,
		font: font,
		scale_factor: config_raw.window_scale,
		color_wheel: base_color_wheel.texture_,
		black_white_gradient: base_color_wheel_gradient.texture_
	};
	base_ui_box = ui_create(ops);
	base_ui_menu = ui_create(ops);

	// Init plugins
	if (config_raw.plugins != null) {
		for (let i: i32 = 0; i < config_raw.plugins.length; ++i) {
			let plugin: string = config_raw.plugins[i];
			plugin_start(plugin);
		}
	}

	args_parse();

	camera_init();
	ui_base_init();
	ui_viewnodes_init();
	ui_view2d_init();
	base_ext_init();

	app_notify_on_update(base_update);
	app_notify_on_render_2d(ui_view2d_render);
	app_notify_on_update(ui_view2d_update);
	app_notify_on_render_2d(ui_base_render_cursor);
	app_notify_on_update(ui_nodes_update);
	app_notify_on_render_2d(ui_nodes_render);
	app_notify_on_update(ui_base_update);
	app_notify_on_render_2d(ui_base_render);
	app_notify_on_update(camera_update);
	app_notify_on_render_2d(base_render);

	base_appx = ui_toolbar_w;
	base_appy = ui_header_h;
	if (config_raw.layout[layout_size_t.HEADER] == 1) {
		base_appy += ui_header_h;
	}
	let cam: camera_object_t = scene_camera;
	cam.data.fov = math_floor(cam.data.fov * 100) / 100;
	camera_object_build_proj(cam);

	args_run();

	let has_projects: bool = config_raw.recent_projects.length > 0;
	if (config_raw.splash_screen && has_projects) {
		box_projects_show();
	}
}

function base_save_and_quit_callback(save: bool) {
	base_save_window_rect();
	if (save) {
		project_save(true);
	}
	else {
		sys_stop();
	}
}

function base_w(): i32 {
	// Drawing material preview
	if (context_raw.material_preview) {
		return util_render_material_preview_size;
	}

	// Drawing decal preview
	if (context_raw.decal_preview) {
		return util_render_decal_preview_size;
	}

	let res: i32 = 0;
	if (config_raw.layout == null) {
		let sidebarw: i32 = ui_base_default_sidebar_w;
		res = sys_width() - sidebarw - ui_toolbar_default_w;
	}
	else if (ui_nodes_show || ui_view2d_show) {
		res = sys_width() - config_raw.layout[layout_size_t.SIDEBAR_W] - config_raw.layout[layout_size_t.NODES_W] - ui_toolbar_w;
	}
	else if (ui_base_show) {
		res = sys_width() - config_raw.layout[layout_size_t.SIDEBAR_W] - ui_toolbar_w;
	}
	else { // Distract free
		res = sys_width();
	}
	if (context_raw.view_index > -1) {
		res = math_floor(res / 2);
	}
	if (context_raw.paint2d_view) {
		res = ui_view2d_ww;
	}

	return res > 0 ? res : 1; // App was minimized, force render path resize
}

function base_h(): i32 {
	// Drawing material preview
	if (context_raw.material_preview) {
		return util_render_material_preview_size;
	}

	// Drawing decal preview
	if (context_raw.decal_preview) {
		return util_render_decal_preview_size;
	}

	let res: i32 = sys_height();

	if (config_raw.layout == null) {
		res -= ui_header_default_h * 2 + ui_status_default_status_h;
		///if (arm_android || arm_ios)
		res += ui_header_h;
		///end
	}
	else if (ui_base_show && res > 0) {
		let statush: i32 = config_raw.layout[layout_size_t.STATUS_H];
		res -= math_floor(ui_header_default_h * 2 * config_raw.window_scale) + statush;

		if (config_raw.layout[layout_size_t.HEADER] == 0) {
			res += ui_header_h;
		}
	}

	return res > 0 ? res : 1; // App was minimized, force render path resize
}

function base_x(): i32 {
	return context_raw.view_index == 1 ? base_appx + base_w() : base_appx;
}

function base_y(): i32 {
	return base_appy;
}

function base_on_resize() {
	if (sys_width() == 0 || sys_height() == 0) {
		return;
	}

	let ratio_w: f32 = sys_width() / base_last_window_width;
	base_last_window_width = sys_width();
	let ratio_h: f32 = sys_height() / base_last_window_height;
	base_last_window_height = sys_height();

	config_raw.layout[layout_size_t.NODES_W] = math_floor(config_raw.layout[layout_size_t.NODES_W] * ratio_w);
	config_raw.layout[layout_size_t.SIDEBAR_H0] = math_floor(config_raw.layout[layout_size_t.SIDEBAR_H0] * ratio_h);
	config_raw.layout[layout_size_t.SIDEBAR_H1] = sys_height() - config_raw.layout[layout_size_t.SIDEBAR_H0];

	base_resize();
	base_save_window_rect();
}

function base_save_window_rect() {
	config_raw.window_w = sys_width();
	config_raw.window_h = sys_height();
	config_raw.window_x = sys_x();
	config_raw.window_y = sys_y();
	config_save();
}

function base_resize() {
	if (sys_width() == 0 || sys_height() == 0) {
		return;
	}

	let cam: camera_object_t = scene_camera;
	if (cam.data.ortho != null) {
		cam.data.ortho[2] = -2 * (app_h() / app_w());
		cam.data.ortho[3] =  2 * (app_h() / app_w());
	}
	camera_object_build_proj(cam);

	if (context_raw.camera_type == camera_type_t.ORTHOGRAPHIC) {
		viewport_update_camera_type(context_raw.camera_type);
	}

	context_raw.ddirty = 2;

	if (ui_base_show) {
		base_appx = ui_toolbar_w;
		base_appy = ui_header_h * 2;
		if (config_raw.layout[layout_size_t.HEADER] == 0) {
			base_appy -= ui_header_h;
		}
	}
	else {
		base_appx = 0;
		base_appy = 0;
	}

	ui_nodes_grid_redraw = true;

	base_redraw_ui();
}

function base_redraw_ui() {
	ui_header_handle.redraws = 2;
	ui_base_hwnds[tab_area_t.STATUS].redraws = 2;
	ui_menubar_menu_handle.redraws = 2;
	ui_menubar_workspace_handle.redraws = 2;
	ui_nodes_hwnd.redraws = 2;
	ui_box_hwnd.redraws = 2;
	ui_view2d_hwnd.redraws = 2;
	// Redraw viewport
	if (context_raw.ddirty < 0) {
		context_raw.ddirty = 0;
	}
	ui_base_hwnds[tab_area_t.SIDEBAR0].redraws = 2;
	ui_base_hwnds[tab_area_t.SIDEBAR1].redraws = 2;
	ui_toolbar_handle.redraws = 2;
	if (context_raw.split_view) {
		context_raw.ddirty = 1;
	}
}

function base_update() {
	if (mouse_movement_x != 0 || mouse_movement_y != 0) {
		iron_set_mouse_cursor(0); // Arrow
	}

	let has_drag: bool = base_drag_asset != null ||
						 base_drag_material != null ||
						 base_drag_layer != null ||
						 base_drag_file != null ||
						 base_drag_swatch != null;

	if (config_raw.touch_ui) {
		// Touch and hold to activate dragging
		if (base_drag_start < 0.2) {
			if (has_drag && mouse_down()) {
				base_drag_start += time_real_delta();
			}
			else {
				base_drag_start = 0;
			}
			has_drag = false;
		}
		if (mouse_released()) {
			base_drag_start = 0;
		}
		let moved: bool = math_abs(mouse_movement_x) > 1 && math_abs(mouse_movement_y) > 1;
		if ((mouse_released() || moved) && !has_drag) {
			base_drag_asset = null;
			base_drag_swatch = null;
			base_drag_file = null;
			base_drag_file_icon = null;
			base_is_dragging = false;
			base_drag_material = null;
			base_drag_layer = null;
		}
		// Disable touch scrolling while dragging is active
		ui_touch_scroll = !base_is_dragging;
	}

	if (has_drag && (mouse_movement_x != 0 || mouse_movement_y != 0)) {
		base_is_dragging = true;
	}
	if (mouse_released() && has_drag) {
		if (base_drag_asset != null) {

			// Create image texture
			if (context_in_nodes()) {
				ui_nodes_accept_asset_drag(array_index_of(project_assets, base_drag_asset));
			}
			else if (context_in_viewport()) {
				if (ends_with(to_lower_case(base_drag_asset.file), ".hdr")) {
					let image: image_t = project_get_image(base_drag_asset);
					import_envmap_run(base_drag_asset.file, image);
				}
			}
			// Create mask
			else if (context_in_layers() || context_in_2d_view()) {
				base_create_image_mask(base_drag_asset);
			}
			base_drag_asset = null;
		}
		else if (base_drag_swatch != null) {
			// Create RGB node
			if (context_in_nodes()) {
				ui_nodes_accept_swatch_drag(base_drag_swatch);
			}
			else if (context_in_swatches()) {
				tab_swatches_accept_swatch_drag(base_drag_swatch);
			}
			else if (context_in_materials()) {
				tab_materials_accept_swatch_drag(base_drag_swatch);
			}
			else if (context_in_viewport()) {
				let color: i32 = base_drag_swatch.base;
				color = color_set_ab(color, base_drag_swatch.opacity * 255);
				base_create_color_layer(color, base_drag_swatch.occlusion, base_drag_swatch.roughness, base_drag_swatch.metallic);
			}
			else if (context_in_layers() && tab_layers_can_drop_new_layer(context_raw.drag_dest)) {
				let color: i32 = base_drag_swatch.base;
				color = color_set_ab(color, base_drag_swatch.opacity * 255);
				base_create_color_layer(color, base_drag_swatch.occlusion, base_drag_swatch.roughness, base_drag_swatch.metallic, context_raw.drag_dest);
			}

			base_drag_swatch = null;
		}
		else if (base_drag_file != null) {
			if (!context_in_browser()) {
				base_drop_x = mouse_x;
				base_drop_y = mouse_y;

				///if (is_paint || is_sculpt)
				_base_material_count = project_materials.length;
				import_asset_run(base_drag_file, base_drop_x, base_drop_y, true, true, function () {
					// Asset was material
					if (project_materials.length > _base_material_count) {
						base_drag_material = context_raw.material;
						base_material_dropped();
					}
				});
				///end

				///if is_lab
				import_asset_run(base_drag_file, base_drop_x, base_drop_y);
				///end
			}
			base_drag_file = null;
			base_drag_file_icon = null;
		}
		else if (base_drag_material != null) {
			base_material_dropped();
		}
		else if (base_drag_layer != null) {
			if (context_in_nodes()) {
				ui_nodes_accept_layer_drag(array_index_of(project_layers, base_drag_layer));
			}
			else if (context_in_layers() && base_is_dragging) {
				slot_layer_move(base_drag_layer, context_raw.drag_dest);
				make_material_parse_mesh_material();
			}
			base_drag_layer = null;
		}

		iron_set_mouse_cursor(0); // Arrow
		base_is_dragging = false;
	}
	if (context_raw.color_picker_callback != null && (mouse_released() || mouse_released("right"))) {
		context_raw.color_picker_callback = null;
		context_select_tool(context_raw.color_picker_previous_tool);
	}

	base_handle_drop_paths();

	///if arm_windows
	let is_picker: bool = context_raw.tool == workspace_tool_t.PICKER || context_raw.tool == workspace_tool_t.MATERIAL;
	let decal: bool = context_raw.tool == workspace_tool_t.DECAL || context_raw.tool == workspace_tool_t.TEXT;
	ui_always_redraw_window = !context_raw.cache_draws ||
							  ui_menu_show ||
							  ui_box_show ||
							  base_is_dragging ||
							  is_picker ||
							  decal ||
							  ui_view2d_show ||
							  !config_raw.brush_3d ||
							  context_raw.frame < 3;
	///end

	if (ui_always_redraw_window && context_raw.ddirty < 0) {
		context_raw.ddirty = 0;
	}
}

function base_material_dropped() {
	// Material drag and dropped onto viewport or layers tab
	if (context_in_viewport()) {
		let uv_type: uv_type_t = keyboard_down("control") ? uv_type_t.PROJECT : uv_type_t.UVMAP;
		let decal_mat: mat4_t = uv_type == uv_type_t.PROJECT ? util_render_get_decal_mat() : mat4_nan();
		base_create_fill_layer(uv_type, decal_mat);
	}
	if (context_in_layers() && tab_layers_can_drop_new_layer(context_raw.drag_dest)) {
		let uv_type: uv_type_t = keyboard_down("control") ? uv_type_t.PROJECT : uv_type_t.UVMAP;
		let decal_mat: mat4_t = uv_type == uv_type_t.PROJECT ? util_render_get_decal_mat() : mat4_nan();
		base_create_fill_layer(uv_type, decal_mat, context_raw.drag_dest);
	}
	else if (context_in_nodes()) {
		ui_nodes_accept_material_drag(array_index_of(project_materials, base_drag_material));
	}
	base_drag_material = null;
}

function base_handle_drop_paths() {
	if (base_drop_paths.length > 0) {
		let wait: bool = false;
		///if (arm_linux || arm_macos)
		wait = !mouse_moved; // Mouse coords not updated during drag
		///end
		if (!wait) {
			base_drop_x = mouse_x;
			base_drop_y = mouse_y;
			let drop_path: string = array_shift(base_drop_paths);
			import_asset_run(drop_path, base_drop_x, base_drop_y);
		}
	}
}

function base_get_drag_background(): rect_t {
	let icons: image_t = resource_get("icons.k");
	if (base_drag_layer != null && !slot_layer_is_group(base_drag_layer) && base_drag_layer.fill_layer == null) {
		return resource_tile50(icons, 4, 1);
	}
	return null;
}

function base_get_drag_image(): image_t {
	base_drag_tint = 0xffffffff;
	base_drag_size = -1;
	base_drag_rect = null;
	if (base_drag_asset != null) {
		return project_get_image(base_drag_asset);
	}
	if (base_drag_swatch != null) {
		base_drag_tint = base_drag_swatch.base;
		base_drag_size = 26;
		return tab_swatches_empty_get();
	}
	if (base_drag_file != null) {
		if (base_drag_file_icon != null) {
			return base_drag_file_icon;
		}
		let icons: image_t = resource_get("icons.k");
		base_drag_rect = string_index_of(base_drag_file, ".") > 0 ? resource_tile50(icons, 3, 1) : resource_tile50(icons, 2, 1);
		base_drag_tint = ui_base_ui.ops.theme.HIGHLIGHT_COL;
		return icons;
	}

	if (base_drag_material != null) {
		return base_drag_material.image_icon;
	}
	if (base_drag_layer != null && slot_layer_is_group(base_drag_layer)) {
		let icons: image_t = resource_get("icons.k");
		let folder_closed: rect_t = resource_tile50(icons, 2, 1);
		let folder_open: rect_t = resource_tile50(icons, 8, 1);
		base_drag_rect = base_drag_layer.show_panel ? folder_open : folder_closed;
		base_drag_tint = ui_base_ui.ops.theme.LABEL_COL - 0x00202020;
		return icons;
	}
	if (base_drag_layer != null && slot_layer_is_mask(base_drag_layer) && base_drag_layer.fill_layer == null) {
		tab_layers_make_mask_preview_rgba32(base_drag_layer);
		return context_raw.mask_preview_rgba32;
	}
	if (base_drag_layer != null) {
		return base_drag_layer.fill_layer != null ? base_drag_layer.fill_layer.image_icon : base_drag_layer.texpaint_preview;
	}

	return null;
}

function base_render() {
	if (sys_width() == 0 || sys_height() == 0) {
		return;
	}

	base_ext_render();

	if (context_raw.frame == 2) {
		make_material_parse_mesh_material();
		make_material_parse_paint_material();
		context_raw.ddirty = 0;

		// Default workspace
		if (config_raw.workspace != 0) {
			ui_header_worktab.position = config_raw.workspace;
			ui_menubar_workspace_handle.redraws = 2;
			ui_header_worktab.changed = true;
		}

		// Default camera controls
		context_raw.camera_controls = config_raw.camera_controls;
	}
	else if (context_raw.frame == 3) {
		context_raw.ddirty = 3;
	}

	context_raw.frame++;

	if (base_is_dragging) {
		iron_set_mouse_cursor(1); // Hand
		let img: image_t = base_get_drag_image();
		let scale_factor: f32 = ui_SCALE(ui_base_ui);
		let size: f32 = (base_drag_size == -1 ? 50 : base_drag_size) * scale_factor;
		let ratio: f32 = size / img.width;
		let h: f32 = img.height * ratio;
		let inv: i32 = 0;

		///if arm_opengl
		inv = (base_drag_material != null || (base_drag_layer != null && base_drag_layer.fill_layer != null)) ? h : 0;
		///end

		g2_set_color(base_drag_tint);

		let bg_rect: rect_t = base_get_drag_background();
		if (bg_rect != null) {
			g2_draw_scaled_sub_image(resource_get("icons.k"), bg_rect.x, bg_rect.y, bg_rect.w, bg_rect.h, mouse_x + base_drag_off_x, mouse_y + base_drag_off_y + inv, size, h - inv * 2);
		}

		base_drag_rect == null ?
			g2_draw_scaled_image(img, mouse_x + base_drag_off_x, mouse_y + base_drag_off_y + inv, size, h - inv * 2) :
			g2_draw_scaled_sub_image(img, base_drag_rect.x, base_drag_rect.y, base_drag_rect.w, base_drag_rect.h, mouse_x + base_drag_off_x, mouse_y + base_drag_off_y + inv, size, h - inv * 2);
		g2_set_color(0xffffffff);
	}

	let using_menu: bool = ui_menu_show && mouse_y > ui_header_h;
	base_ui_enabled = !ui_box_show && !using_menu && !base_is_combo_selected();
	if (ui_box_show) {
		ui_box_render();
	}
	if (ui_menu_show) {
		ui_menu_render();
	}

	// Save last pos for continuos paint
	context_raw.last_paint_vec_x = context_raw.paint_vec.x;
	context_raw.last_paint_vec_y = context_raw.paint_vec.y;

	///if (arm_android || arm_ios)
	// No mouse move events for touch, re-init last paint position on touch start
	if (!mouse_down()) {
		context_raw.last_paint_x = -1;
		context_raw.last_paint_y = -1;
	}
	///end
}

function base_enum_texts(node_type: string): string[] {
	if (node_type == "TEX_IMAGE") {
		if (project_asset_names.length > 0) {
			return project_asset_names;
		}
		else {
			let empty: string[] = [""];
			return empty;
		}
	}
	if (node_type == "LAYER" || node_type == "LAYER_MASK") {
		let layer_names: string[] = [];
		for (let i: i32 = 0; i < project_layers.length; ++i) {
			let l: slot_layer_t = project_layers[i];
			array_push(layer_names, l.name);
		}
		return layer_names;
	}
	if (node_type == "MATERIAL") {
		let material_names: string[] = [];
		for (let i: i32 = 0; i < project_materials.length; ++i) {
			let m: slot_material_t = project_materials[i];
			array_push(material_names, m.canvas.name);
		}
		return material_names;
	}

	if (node_type == "image_texture_node") {
		if (project_asset_names.length > 0) {
			return project_asset_names;
		}
		else {
			let empty: string[] = [""];
			return empty;
		}
	}

	return null;
}

function base_get_asset_index(file_name: string): i32 {
	let i: i32 = array_index_of(project_asset_names, file_name);
	return i >= 0 ? i : 0;
}

function base_toggle_fullscreen() {
	if (sys_mode() == window_mode_t.WINDOWED) {
		config_raw.window_w = sys_width();
		config_raw.window_h = sys_height();
		config_raw.window_x = sys_x();
		config_raw.window_y = sys_y();
		sys_mode_set(window_mode_t.FULLSCREEN);
	}
	else {
		sys_mode_set(window_mode_t.WINDOWED);
		sys_resize(config_raw.window_w, config_raw.window_h);
		sys_move(config_raw.window_x, config_raw.window_y);
	}
}

function base_is_scrolling(): bool {
	for (let i: i32 = 0; i < base_get_uis().length; ++i) {
		let ui: ui_t = base_get_uis()[i];
		if (ui.is_scrolling) {
			return true;
		}
	}
	return false;
}

function base_is_combo_selected(): bool {
	for (let i: i32 = 0; i < base_get_uis().length; ++i) {
		let ui: ui_t = base_get_uis()[i];
		if (ui.combo_selected_handle != null) {
			return true;
		}
	}
	return false;
}

function base_get_uis(): ui_t[] {
	let uis: ui_t[] = [base_ui_box, base_ui_menu, ui_base_ui, ui_nodes_ui, ui_view2d_ui];
	return uis;
}

function base_is_decal_layer(): bool {
	///if (is_sculpt || is_lab)
	return false;
	///end

	let is_painting: bool = context_raw.tool != workspace_tool_t.MATERIAL && context_raw.tool != workspace_tool_t.BAKE;
	return is_painting && context_raw.layer.fill_layer != null && context_raw.layer.uv_type == uv_type_t.PROJECT;
}

function base_redraw_status() {
	ui_base_hwnds[tab_area_t.STATUS].redraws = 2;
}

function base_redraw_console() {
	let statush: i32 = config_raw.layout[layout_size_t.STATUS_H];
	if (ui_base_ui != null && statush > ui_status_default_status_h * ui_SCALE(ui_base_ui)) {
		ui_base_hwnds[tab_area_t.STATUS].redraws = 2;
	}
}

function base_init_layout() {
	let raw: config_t = config_raw;
	let show2d: bool = (ui_nodes_show || ui_view2d_show) && raw.layout != null;
	raw.layout = [];

	array_push(raw.layout, math_floor(ui_base_default_sidebar_w * raw.window_scale)); // LayoutSidebarW
	array_push(raw.layout, math_floor(sys_height() / 2)); // LayoutSidebarH0
	array_push(raw.layout, math_floor(sys_height() / 2)); // LayoutSidebarH1

	///if arm_ios
	array_push(raw.layout, show2d ? math_floor((app_w() + raw.layout[layout_size_t.NODES_W]) * 0.473) : math_floor(app_w() * 0.473)); // LayoutNodesW
	///elseif arm_android
	array_push(raw.layout, show2d ? math_floor((app_w() + raw.layout[layout_size_t.NODES_W]) * 0.473) : math_floor(app_w() * 0.473));
	///else
	array_push(raw.layout, show2d ? math_floor((app_w() + raw.layout[layout_size_t.NODES_W]) * 0.515) : math_floor(app_w() * 0.515)); // Align with ui header controls
	///end

	array_push(raw.layout, math_floor(app_h() / 2)); // LayoutNodesH
	array_push(raw.layout, math_floor(ui_status_default_status_h * raw.window_scale)); // LayoutStatusH

	///if (arm_android || arm_ios)
	array_push(raw.layout, 0); // LayoutHeader
	///else
	array_push(raw.layout, 1);
	///end

	raw.layout_tabs = [
		0,
		0,
		0
	];
}

function base_init_config() {
	let raw: config_t = config_raw;
	raw.recent_projects = [];
	raw.bookmarks = [];
	raw.plugins = [];
	///if (arm_android || arm_ios)
	raw.keymap = "touch.json";
	///else
	raw.keymap = "default.json";
	///end
	raw.theme = "default.json";
	raw.server = "https://armorpaint.fra1.digitaloceanspaces.com";
	raw.undo_steps = 4;
	raw.pressure_radius = true;
	raw.pressure_sensitivity = 1.0;
	raw.camera_zoom_speed = 1.0;
	raw.camera_pan_speed = 1.0;
	raw.camera_rotation_speed = 1.0;
	raw.zoom_direction = zoom_direction_t.VERTICAL;
	///if (is_paint || is_sculpt)
	raw.displace_strength = 0.0;
	///else
	raw.displace_strength = 1.0;
	///end
	raw.wrap_mouse = false;
	raw.workspace = space_type_t.SPACE3D;
	///if is_lab
	raw.workspace = space_type_t.SPACE2D;
	///end
	///if (arm_android || arm_ios)
	raw.camera_controls = camera_controls_t.ROTATE;
	///else
	raw.camera_controls = camera_controls_t.ORBIT;
	///end
	raw.layer_res = texture_res_t.RES2048;
	///if (arm_android || arm_ios)
	raw.touch_ui = true;
	raw.splash_screen = true;
	///else
	raw.touch_ui = false;
	raw.splash_screen = false;
	///end
	///if (is_paint || is_sculpt)
	raw.node_preview = true;
	///else
	raw.node_preview = false;
	///end

	raw.pressure_hardness = true;
	raw.pressure_angle = false;
	raw.pressure_opacity = false;
	///if (arm_vulkan || arm_ios)
	raw.material_live = false;
	///else
	raw.material_live = true;
	///end
	raw.brush_3d = true;
	raw.brush_depth_reject = true;
	raw.brush_angle_reject = true;
	raw.brush_live = false;
	raw.show_asset_names = false;
	raw.dilate = dilate_type_t.INSTANT;
	raw.dilate_radius = 2;
	raw.gpu_inference = true;
}

function base_init_layers() {
	///if (is_paint || is_sculpt)
	slot_layer_clear(project_layers[0], color_from_floats(base_default_base, base_default_base, base_default_base, 1.0));
	///end

	///if is_lab
	let texpaint: render_target_t = map_get(render_path_render_targets, "texpaint");
	let texpaint_nor: render_target_t = map_get(render_path_render_targets, "texpaint_nor");
	let texpaint_pack: render_target_t = map_get(render_path_render_targets, "texpaint_pack");
	g2_begin(texpaint._image);
	g2_draw_scaled_image(resource_get("placeholder.k"), 0, 0, config_get_texture_res_x(), config_get_texture_res_y()); // Base
	g2_end();
	g4_begin(texpaint_nor._image);
	g4_clear(color_from_floats(0.5, 0.5, 1.0, 0.0)); // Nor
	g4_end();
	g4_begin(texpaint_pack._image);
	g4_clear(color_from_floats(1.0, 0.4, 0.0, 0.0)); // Occ, rough, met
	g4_end();
	let texpaint_nor_empty: render_target_t = map_get(render_path_render_targets, "texpaint_nor_empty");
	let texpaint_pack_empty: render_target_t = map_get(render_path_render_targets, "texpaint_pack_empty");
	g4_begin(texpaint_nor_empty._image);
	g4_clear(color_from_floats(0.5, 0.5, 1.0, 0.0)); // Nor
	g4_end();
	g4_begin(texpaint_pack_empty._image);
	g4_clear(color_from_floats(1.0, 0.4, 0.0, 0.0)); // Occ, rough, met
	g4_end();
	///end
}

function base_resize_layers() {
	let conf: config_t = config_raw;
	if (base_res_handle.position >= math_floor(texture_res_t.RES16384)) { // Save memory for >=16k
		conf.undo_steps = 1;
		if (context_raw.undo_handle != null) {
			context_raw.undo_handle.value = conf.undo_steps;
		}
		while (history_undo_layers.length > conf.undo_steps) {
			let l: slot_layer_t = array_pop(history_undo_layers);
			app_notify_on_next_frame(function (l: slot_layer_t) {
				slot_layer_unload(l);
			}, l);
		}
	}
	for (let i: i32 = 0; i < project_layers.length; ++i) {
		let l: slot_layer_t = project_layers[i];
		slot_layer_resize_and_set_bits(l);
	}
	for (let i: i32 = 0; i < history_undo_layers.length; ++i) {
		let l: slot_layer_t = history_undo_layers[i];
		slot_layer_resize_and_set_bits(l);
	}

	let rts: map_t<string, render_target_t> = render_path_render_targets;

	let blend0: render_target_t = map_get(rts, "texpaint_blend0");
	let _texpaint_blend0: image_t = blend0._image;
	app_notify_on_next_frame(function (_texpaint_blend0: image_t) {
		image_unload(_texpaint_blend0);
	}, _texpaint_blend0);
	blend0.width = config_get_texture_res_x();
	blend0.height = config_get_texture_res_y();
	blend0._image = image_create_render_target(config_get_texture_res_x(), config_get_texture_res_y(), tex_format_t.R8);

	let blend1: render_target_t = map_get(rts, "texpaint_blend1");
	let _texpaint_blend1: image_t = blend1._image;
	app_notify_on_next_frame(function (_texpaint_blend1: image_t) {
		image_unload(_texpaint_blend1);
	}, _texpaint_blend1);
	blend1.width = config_get_texture_res_x();
	blend1.height = config_get_texture_res_y();
	blend1._image = image_create_render_target(config_get_texture_res_x(), config_get_texture_res_y(), tex_format_t.R8);

	context_raw.brush_blend_dirty = true;

	let blur: render_target_t = map_get(rts, "texpaint_blur");
	if (blur != null) {
		let _texpaint_blur: image_t = blur._image;
		app_notify_on_next_frame(function (_texpaint_blur: image_t) {
			image_unload(_texpaint_blur);
		}, _texpaint_blur);
		let size_x: f32 = math_floor(config_get_texture_res_x() * 0.95);
		let size_y: f32 = math_floor(config_get_texture_res_y() * 0.95);
		blur.width = size_x;
		blur.height = size_y;
		blur._image = image_create_render_target(size_x, size_y);
	}
	if (render_path_paint_live_layer != null) {
		slot_layer_resize_and_set_bits(render_path_paint_live_layer);
	}
	///if (arm_direct3d12 || arm_vulkan || arm_metal)
	render_path_raytrace_ready = false; // Rebuild baketex
	///end
	context_raw.ddirty = 2;
}

function base_set_layer_bits() {
	for (let i: i32 = 0; i < project_layers.length; ++i) {
		let l: slot_layer_t = project_layers[i];
		slot_layer_resize_and_set_bits(l);
	}
	for (let i: i32 = 0; i < history_undo_layers.length; ++i) {
		let l: slot_layer_t = history_undo_layers[i];
		slot_layer_resize_and_set_bits(l);
	}
}

function base_make_temp_img() {
	///if (is_paint || is_sculpt)
	let l: slot_layer_t = project_layers[0];
	///end
	///if is_lab
	let l: brush_output_node_t = brush_output_node_inst;
	///end

	if (base_temp_image != null && (base_temp_image.width != l.texpaint.width || base_temp_image.height != l.texpaint.height || base_temp_image.format != l.texpaint.format)) {
		let _temptex0: render_target_t = map_get(render_path_render_targets, "temptex0");
		app_notify_on_next_frame(function (_temptex0: render_target_t) {
			render_target_unload(_temptex0);
		}, _temptex0);
		map_delete(render_path_render_targets, "temptex0");
		base_temp_image = null;
	}
	if (base_temp_image == null) {
		let format: string = base_bits_handle.position == texture_bits_t.BITS8  ? "RGBA32" :
							 base_bits_handle.position == texture_bits_t.BITS16 ? "RGBA64" :
																				  "RGBA128";
		///if is_lab
		format = "RGBA32";
		///end

		let t: render_target_t = render_target_create();
		t.name = "temptex0";
		t.width = l.texpaint.width;
		t.height = l.texpaint.height;
		t.format = format;
		let rt: render_target_t = render_path_create_render_target(t);
		base_temp_image = rt._image;
	}
}

function base_make_temp_mask_img() {
	if (base_temp_mask_image != null && (base_temp_mask_image.width != config_get_texture_res_x() || base_temp_mask_image.height != config_get_texture_res_y())) {
		let _temp_mask_image: image_t = base_temp_mask_image;
		app_notify_on_next_frame(function (_temp_mask_image: image_t) {
			image_unload(_temp_mask_image);
		}, _temp_mask_image);
		base_temp_mask_image = null;
	}
	if (base_temp_mask_image == null) {
		base_temp_mask_image = image_create_render_target(config_get_texture_res_x(), config_get_texture_res_y(), tex_format_t.R8);
	}
}

function base_make_export_img() {
	///if (is_paint || is_sculpt)
	let l: slot_layer_t = project_layers[0];
	///end
	///if is_lab
	let l: brush_output_node_t = brush_output_node_inst;
	///end

	if (base_expa != null && (base_expa.width != l.texpaint.width || base_expa.height != l.texpaint.height || base_expa.format != l.texpaint.format)) {
		let _expa: image_t = base_expa;
		let _expb: image_t = base_expb;
		let _expc: image_t = base_expc;
		app_notify_on_next_frame(function (_expa: image_t) {
			image_unload(_expa);
		}, _expa);
		app_notify_on_next_frame(function (_expb: image_t) {
			image_unload(_expb);
		}, _expb);
		app_notify_on_next_frame(function (_expc: image_t) {
			image_unload(_expc);
		}, _expc);
		base_expa = null;
		base_expb = null;
		base_expc = null;
		map_delete(render_path_render_targets, "expa");
		map_delete(render_path_render_targets, "expb");
		map_delete(render_path_render_targets, "expc");
	}
	if (base_expa == null) {
		let format: string = base_bits_handle.position == texture_bits_t.BITS8  ? "RGBA32" :
							 base_bits_handle.position == texture_bits_t.BITS16 ? "RGBA64" :
																				  "RGBA128";

		///if is_lab
		format = "RGBA32";
		///end

		{
			let t: render_target_t = render_target_create();
			t.name = "expa";
			t.width = l.texpaint.width;
			t.height = l.texpaint.height;
			t.format = format;
			let rt: render_target_t = render_path_create_render_target(t);
			base_expa = rt._image;
		}

		{
			let t: render_target_t = render_target_create();
			t.name = "expb";
			t.width = l.texpaint.width;
			t.height = l.texpaint.height;
			t.format = format;
			let rt: render_target_t = render_path_create_render_target(t);
			base_expb = rt._image;
		}

		{
			let t: render_target_t = render_target_create();
			t.name = "expc";
			t.width = l.texpaint.width;
			t.height = l.texpaint.height;
			t.format = format;
			let rt: render_target_t = render_path_create_render_target(t);
			base_expc = rt._image;
		}
	}
}

function base_apply_mask(l: slot_layer_t, m: slot_layer_t) {
	if (!slot_layer_is_layer(l) || !slot_layer_is_mask(m)) {
		return;
	}

	if (base_pipe_merge == null) {
		base_make_pipe();
	}
	base_make_temp_img();

	// Copy layer to temp
	g2_begin(base_temp_image);
	g2_set_pipeline(base_pipe_copy);
	g2_draw_image(l.texpaint, 0, 0);
	g2_set_pipeline(null);
	g2_end();

	// Apply mask
	if (const_data_screen_aligned_vb == null) {
		const_data_create_screen_aligned_data();
	}
	g4_begin(l.texpaint);
	g4_set_pipeline(base_pipe_apply_mask);
	g4_set_tex(base_tex0_mask, base_temp_image);
	g4_set_tex(base_texa_mask, m.texpaint);
	g4_set_vertex_buffer(const_data_screen_aligned_vb);
	g4_set_index_buffer(const_data_screen_aligned_ib);
	g4_draw();
	g4_end();
}

function base_commands_merge_pack(pipe: pipeline_t, i0: image_t, i1: image_t, i1pack: image_t, i1mask_opacity: f32, i1texmask: image_t, i1blending: i32 = -1) {
	g4_begin(i0);
	g4_set_pipeline(pipe);
	g4_set_tex(base_tex0, i1);
	g4_set_tex(base_tex1, i1pack);
	g4_set_tex(base_texmask, i1texmask);
	g4_set_tex(base_texa, base_temp_image);
	g4_set_float(base_opac, i1mask_opacity);
	g4_set_int(base_blending, i1blending);
	g4_set_vertex_buffer(const_data_screen_aligned_vb);
	g4_set_index_buffer(const_data_screen_aligned_ib);
	g4_draw();
	g4_end();
}

function base_is_fill_material(): bool {
	if (context_raw.tool == workspace_tool_t.MATERIAL) {
		return true;
	}

	let m: slot_material_t = context_raw.material;
	for (let i: i32 = 0; i < project_layers.length; ++i) {
		let l: slot_layer_t = project_layers[i];
		if (l.fill_layer == m) {
			return true;
		}
	}
	return false;
}

function base_update_fill_layers() {
	let _layer: slot_layer_t = context_raw.layer;
	let _tool: workspace_tool_t = context_raw.tool;
	let _fill_type: i32 = context_raw.fill_type_handle.position;
	let current: image_t = null;

	if (context_raw.tool == workspace_tool_t.MATERIAL) {
		if (render_path_paint_live_layer == null) {
			render_path_paint_live_layer = slot_layer_create("_live");
		}

		current = _g2_current;
		if (current != null) g2_end();

		context_raw.tool = workspace_tool_t.FILL;
		context_raw.fill_type_handle.position = fill_type_t.OBJECT;
		make_material_parse_paint_material(false);
		context_raw.pdirty = 1;
		render_path_paint_use_live_layer(true);
		render_path_paint_commands_paint(false);
		render_path_paint_dilate(true, true);
		render_path_paint_use_live_layer(false);
		context_raw.tool = _tool;
		context_raw.fill_type_handle.position = _fill_type;
		context_raw.pdirty = 0;
		context_raw.rdirty = 2;

		if (current != null) g2_begin(current);
		return;
	}

	let has_fill_layer: bool = false;
	let has_fill_mask: bool = false;
	for (let i: i32 = 0; i < project_layers.length; ++i) {
		let l: slot_layer_t = project_layers[i];
		if (slot_layer_is_layer(l) && l.fill_layer == context_raw.material) {
			has_fill_layer = true;
		}
	}
	for (let i: i32 = 0; i < project_layers.length; ++i) {
		let l: slot_layer_t = project_layers[i];
		if (slot_layer_is_mask(l) && l.fill_layer == context_raw.material) {
			has_fill_mask = true;
		}
	}

	if (has_fill_layer || has_fill_mask) {
		current = _g2_current;
		if (current != null) {
			g2_end();
		}
		context_raw.pdirty = 1;
		context_raw.tool = workspace_tool_t.FILL;
		context_raw.fill_type_handle.position = fill_type_t.OBJECT;

		if (has_fill_layer) {
			let first: bool = true;
			for (let i: i32 = 0; i < project_layers.length; ++i) {
				let l: slot_layer_t = project_layers[i];
				if (slot_layer_is_layer(l) && l.fill_layer == context_raw.material) {
					context_raw.layer = l;
					if (first) {
						first = false;
						make_material_parse_paint_material(false);
					}
					base_set_object_mask();
					slot_layer_clear(l);
					render_path_paint_commands_paint(false);
					render_path_paint_dilate(true, true);
				}
			}
		}
		if (has_fill_mask) {
			let first: bool = true;
			for (let i: i32 = 0; i < project_layers.length; ++i) {
				let l: slot_layer_t = project_layers[i];
				if (slot_layer_is_mask(l) && l.fill_layer == context_raw.material) {
					context_raw.layer = l;
					if (first) {
						first = false;
						make_material_parse_paint_material(false);
					}
					base_set_object_mask();
					slot_layer_clear(l);
					render_path_paint_commands_paint(false);
					render_path_paint_dilate(true, true);
				}
			}
		}

		context_raw.pdirty = 0;
		context_raw.ddirty = 2;
		context_raw.rdirty = 2;
		context_raw.layers_preview_dirty = true; // Repaint all layer previews as multiple layers might have changed.
		if (current != null) g2_begin(current);
		context_raw.layer = _layer;
		base_set_object_mask();
		context_raw.tool = _tool;
		context_raw.fill_type_handle.position = _fill_type;
		make_material_parse_paint_material(false);
	}
}

function base_update_fill_layer(parse_paint: bool = true) {
	let current: image_t = _g2_current;
	let g2_in_use: bool = _g2_in_use;
	if (g2_in_use) g2_end();

	let _tool: workspace_tool_t = context_raw.tool;
	let _fill_type: i32 = context_raw.fill_type_handle.position;
	context_raw.tool = workspace_tool_t.FILL;
	context_raw.fill_type_handle.position = fill_type_t.OBJECT;
	context_raw.pdirty = 1;

	slot_layer_clear(context_raw.layer);

	if (parse_paint) {
		make_material_parse_paint_material(false);
	}
	render_path_paint_commands_paint(false);
	render_path_paint_dilate(true, true);

	context_raw.rdirty = 2;
	context_raw.tool = _tool;
	context_raw.fill_type_handle.position = _fill_type;
	if (g2_in_use) g2_begin(current);
}

function base_set_object_mask() {
	///if is_sculpt
	return;
	///end

	let ar: string[] = [tr("None")];
	for (let i: i32 = 0; i < project_paint_objects.length; ++i) {
		let p: mesh_object_t = project_paint_objects[i];
		array_push(ar, p.base.name);
	}

	let mask: i32 = context_object_mask_used() ? slot_layer_get_object_mask(context_raw.layer) : 0;
	if (context_layer_filter_used()) {
		mask = context_raw.layer_filter;
	}
	if (mask > 0) {
		if (context_raw.merged_object != null) {
			context_raw.merged_object.base.visible = false;
		}
		let o: mesh_object_t = project_paint_objects[0];
		for (let i: i32 = 0; i < project_paint_objects.length; ++i) {
			let p: mesh_object_t = project_paint_objects[i];
			let mask_name: string = ar[mask];
			if (p.base.name == mask_name) {
				o = p;
				break;
			}
		}
		context_select_paint_object(o);
	}
	else {
		let is_atlas: bool = slot_layer_get_object_mask(context_raw.layer) > 0 && slot_layer_get_object_mask(context_raw.layer) <= project_paint_objects.length;
		if (context_raw.merged_object == null || is_atlas || context_raw.merged_object_is_atlas) {
			let visibles: mesh_object_t[] = is_atlas ? project_get_atlas_objects(slot_layer_get_object_mask(context_raw.layer)) : null;
			util_mesh_merge(visibles);
		}
		context_select_paint_object(context_main_object());
		context_raw.paint_object.skip_context = "paint";
		context_raw.merged_object.base.visible = true;
	}
	util_uv_dilatemap_cached = false;
}

function base_new_layer(clear: bool = true, position: i32 = -1): slot_layer_t {
	if (project_layers.length > base_max_layers) {
		return null;
	}

	let l: slot_layer_t = slot_layer_create();
	l.object_mask = context_raw.layer_filter;

	if (position == -1) {
		if (slot_layer_is_mask(context_raw.layer)) context_set_layer(context_raw.layer.parent);
		array_insert(project_layers, array_index_of(project_layers, context_raw.layer) + 1, l);
	}
	else {
		array_insert(project_layers, position, l);
	}

	context_set_layer(l);
	let li: i32 = array_index_of(project_layers, context_raw.layer);
	if (li > 0) {
		let below: slot_layer_t = project_layers[li - 1];
		if (slot_layer_is_layer(below)) {
			context_raw.layer.parent = below.parent;
		}
	}
	if (clear) {
		app_notify_on_init(function (l: slot_layer_t) {
			slot_layer_clear(l);
		}, l);
	}
	context_raw.layer_preview_dirty = true;
	return l;
}

function base_new_mask(clear: bool = true, parent: slot_layer_t, position: i32 = -1): slot_layer_t {
	if (project_layers.length > base_max_layers) {
		return null;
	}
	let l: slot_layer_t = slot_layer_create("", layer_slot_type_t.MASK, parent);
	if (position == -1) {
		position = array_index_of(project_layers, parent);
	}
	array_insert(project_layers, position, l);
	context_set_layer(l);
	if (clear) {
		app_notify_on_init(function (l: slot_layer_t) {
			slot_layer_clear(l);
		}, l);
	}
	context_raw.layer_preview_dirty = true;
	return l;
}

function base_new_group(): slot_layer_t {
	if (project_layers.length > base_max_layers) {
		return null;
	}
	let l: slot_layer_t = slot_layer_create("", layer_slot_type_t.GROUP);
	array_push(project_layers, l);
	context_set_layer(l);
	return l;
}

function base_create_fill_layer(uv_type: uv_type_t = uv_type_t.UVMAP, decal_mat: mat4_t = mat4nan, position: i32 = -1) {
	_base_uv_type = uv_type;
	_base_decal_mat = decal_mat;
	_base_position = position;
	app_notify_on_init(function () {
		let l: slot_layer_t = base_new_layer(false, _base_position);
		history_new_layer();
		l.uv_type = _base_uv_type;
		if (!mat4_isnan(_base_decal_mat)) {
			l.decal_mat = _base_decal_mat;
		}
		l.object_mask = context_raw.layer_filter;
		history_to_fill_layer();
		slot_layer_to_fill_layer(l);
	});
}

function base_create_image_mask(asset: asset_t) {
	let l: slot_layer_t = context_raw.layer;
	if (slot_layer_is_mask(l) || slot_layer_is_group(l)) {
		return;
	}

	history_new_layer();
	let m: slot_layer_t = base_new_mask(false, l);
	slot_layer_clear(m, 0x00000000, project_get_image(asset));
	context_raw.layer_preview_dirty = true;
}

function base_create_color_layer(base_color: i32, occlusion: f32 = 1.0, roughness: f32 = base_default_rough, metallic: f32 = 0.0, position: i32 = -1) {
	_base_base_color = base_color;
	_base_occlusion = occlusion;
	_base_roughness = roughness;
	_base_metallic = metallic;
	_base_position = position;

	app_notify_on_init(function () {
		let l: slot_layer_t = base_new_layer(false, _base_position);
		history_new_layer();
		l.uv_type = uv_type_t.UVMAP;
		l.object_mask = context_raw.layer_filter;
		slot_layer_clear(l, _base_base_color, null, _base_occlusion, _base_roughness, _base_metallic);
	});
}

function base_duplicate_layer(l: slot_layer_t) {
	if (!slot_layer_is_group(l)) {
		let new_layer: slot_layer_t = slot_layer_duplicate(l);
		context_set_layer(new_layer);
		let masks: slot_layer_t[] = slot_layer_get_masks(l, false);
		if (masks != null) {
			for (let i: i32 = 0; i < masks.length; ++i) {
				let m: slot_layer_t = masks[i];
				m = slot_layer_duplicate(m);
				m.parent = new_layer;
				array_remove(project_layers, m);
				array_insert(project_layers, array_index_of(project_layers, new_layer), m);
			}
		}
		context_set_layer(new_layer);
	}
	else {
		let new_group: slot_layer_t = base_new_group();
		array_remove(project_layers, new_group);
		array_insert(project_layers, array_index_of(project_layers, l) + 1, new_group);
		// group.show_panel = true;
		for (let i: i32 = 0; i < slot_layer_get_children(l).length; ++i) {
			let c: slot_layer_t = slot_layer_get_children(l)[i];
			let masks: slot_layer_t[] = slot_layer_get_masks(c, false);
			let new_layer: slot_layer_t = slot_layer_duplicate(c);
			new_layer.parent = new_group;
			array_remove(project_layers, new_layer);
			array_insert(project_layers, array_index_of(project_layers, new_group), new_layer);
			if (masks != null) {
				for (let i: i32 = 0; i < masks.length; ++i) {
					let m: slot_layer_t = masks[i];
					let new_mask: slot_layer_t = slot_layer_duplicate(m);
					new_mask.parent = new_layer;
					array_remove(project_layers, new_mask);
					array_insert(project_layers, array_index_of(project_layers, new_layer), new_mask);
				}
			}
		}
		let group_masks: slot_layer_t[] = slot_layer_get_masks(l);
		if (group_masks != null) {
			for (let i: i32 = 0; i < group_masks.length; ++i) {
				let m: slot_layer_t = group_masks[i];
				let new_mask: slot_layer_t = slot_layer_duplicate(m);
				new_mask.parent = new_group;
				array_remove(project_layers, new_mask);
				array_insert(project_layers, array_index_of(project_layers, new_group), new_mask);
			}
		}
		context_set_layer(new_group);
	}
}

function base_apply_masks(l: slot_layer_t) {
	let masks: slot_layer_t[] = slot_layer_get_masks(l);

	if (masks != null) {
		for (let i: i32 = 0; i < masks.length - 1; ++i) {
			base_merge_layer(masks[i + 1], masks[i]);
			slot_layer_delete(masks[i]);
		}
		slot_layer_apply_mask(masks[masks.length - 1]);
		context_raw.layer_preview_dirty = true;
	}
}

function base_merge_down() {
	let l1: slot_layer_t = context_raw.layer;

	if (slot_layer_is_group(l1)) {
		l1 = base_merge_group(l1);
	}
	else if (slot_layer_has_masks(l1)) { // It is a layer
		base_apply_masks(l1);
		context_set_layer(l1);
	}

	let l0: slot_layer_t = project_layers[array_index_of(project_layers, l1) - 1];

	if (slot_layer_is_group(l0)) {
		l0 = base_merge_group(l0);
	}
	else if (slot_layer_has_masks(l0)) { // It is a layer
		base_apply_masks(l0);
		context_set_layer(l0);
	}

	base_merge_layer(l0, l1);
	slot_layer_delete(l1);
	context_set_layer(l0);
	context_raw.layer_preview_dirty = true;
}

function base_merge_group(l: slot_layer_t): slot_layer_t {
	if (!slot_layer_is_group(l)) {
		return null;
	}

	let children: slot_layer_t[] = slot_layer_get_children(l);

	if (children.length == 1 && slot_layer_has_masks(children[0], false)) {
		base_apply_masks(children[0]);
	}

	for (let i: i32 = 0; i < children.length - 1; ++i) {
		context_set_layer(children[children.length - 1 - i]);
		history_merge_layers();
		base_merge_down();
	}

	// Now apply the group masks
	let masks: slot_layer_t[] = slot_layer_get_masks(l);
	if (masks != null) {
		for (let i: i32 = 0; i < masks.length - 1; ++i) {
			base_merge_layer(masks[i + 1], masks[i]);
			slot_layer_delete(masks[i]);
		}
		base_apply_mask(children[0], masks[masks.length - 1]);
	}

	children[0].parent = null;
	children[0].name = l.name;
	if (children[0].fill_layer != null) {
		slot_layer_to_paint_layer(children[0]);
	}
	slot_layer_delete(l);
	return children[0];
}

function base_merge_layer(l0 : slot_layer_t, l1: slot_layer_t, use_mask: bool = false) {
	if (!l1.visible || slot_layer_is_group(l1)) {
		return;
	}

	if (base_pipe_merge == null) {
		base_make_pipe();
	}
	base_make_temp_img();
	if (const_data_screen_aligned_vb == null) {
		const_data_create_screen_aligned_data();
	}

	g2_begin(base_temp_image); // Copy to temp
	g2_set_pipeline(base_pipe_copy);
	g2_draw_image(l0.texpaint, 0, 0);
	g2_set_pipeline(null);
	g2_end();

	let empty_rt: render_target_t = map_get(render_path_render_targets, "empty_white");
	let empty: image_t = empty_rt._image;
	let mask: image_t = empty;
	let l1masks: slot_layer_t[] =  use_mask ? slot_layer_get_masks(l1) : null;
	if (l1masks != null) {
		// for (let i: i32 = 1; i < l1masks.length - 1; ++i) {
		// 	mergeLayer(l1masks[i + 1], l1masks[i]);
		// }
		mask = l1masks[0].texpaint;
	}

	if (slot_layer_is_mask(l1)) {
		g4_begin(l0.texpaint);
		g4_set_pipeline(base_pipe_merge_mask);
		g4_set_tex(base_tex0_merge_mask, l1.texpaint);
		g4_set_tex(base_texa_merge_mask, base_temp_image);
		g4_set_float(base_opac_merge_mask, slot_layer_get_opacity(l1));
		g4_set_int(base_blending_merge_mask, l1.blending);
		g4_set_vertex_buffer(const_data_screen_aligned_vb);
		g4_set_index_buffer(const_data_screen_aligned_ib);
		g4_draw();
		g4_end();
	}

	if (slot_layer_is_layer(l1)) {
		if (l1.paint_base) {
			g4_begin(l0.texpaint);
			g4_set_pipeline(base_pipe_merge);
			g4_set_tex(base_tex0, l1.texpaint);
			g4_set_tex(base_tex1, empty);
			g4_set_tex(base_texmask, mask);
			g4_set_tex(base_texa, base_temp_image);
			g4_set_float(base_opac, slot_layer_get_opacity(l1));
			g4_set_int(base_blending, l1.blending);
			g4_set_vertex_buffer(const_data_screen_aligned_vb);
			g4_set_index_buffer(const_data_screen_aligned_ib);
			g4_draw();
			g4_end();
		}

		if (l0.texpaint_nor != null) {
			g2_begin(base_temp_image);
			g2_set_pipeline(base_pipe_copy);
			g2_draw_image(l0.texpaint_nor, 0, 0);
			g2_set_pipeline(null);
			g2_end();

			if (l1.paint_nor) {
				g4_begin(l0.texpaint_nor);
				g4_set_pipeline(base_pipe_merge);
				g4_set_tex(base_tex0, l1.texpaint);
				g4_set_tex(base_tex1, l1.texpaint_nor);
				g4_set_tex(base_texmask, mask);
				g4_set_tex(base_texa, base_temp_image);
				g4_set_float(base_opac, slot_layer_get_opacity(l1));
				g4_set_int(base_blending, l1.paint_nor_blend ? -2 : -1);
				g4_set_vertex_buffer(const_data_screen_aligned_vb);
				g4_set_index_buffer(const_data_screen_aligned_ib);
				g4_draw();
				g4_end();
			}
		}

		if (l0.texpaint_pack != null) {
			g2_begin(base_temp_image);
			g2_set_pipeline(base_pipe_copy);
			g2_draw_image(l0.texpaint_pack, 0, 0);
			g2_set_pipeline(null);
			g2_end();

			if (l1.paint_occ || l1.paint_rough || l1.paint_met || l1.paint_height) {
				if (l1.paint_occ && l1.paint_rough && l1.paint_met && l1.paint_height) {
					base_commands_merge_pack(base_pipe_merge, l0.texpaint_pack, l1.texpaint, l1.texpaint_pack, slot_layer_get_opacity(l1), mask, l1.paint_height_blend ? -3 : -1);
				}
				else {
					if (l1.paint_occ) {
						base_commands_merge_pack(base_pipe_merge_r, l0.texpaint_pack, l1.texpaint, l1.texpaint_pack, slot_layer_get_opacity(l1), mask);
					}
					if (l1.paint_rough) {
						base_commands_merge_pack(base_pipe_merge_g, l0.texpaint_pack, l1.texpaint, l1.texpaint_pack, slot_layer_get_opacity(l1), mask);
					}
					if (l1.paint_met) {
						base_commands_merge_pack(base_pipe_merge_b, l0.texpaint_pack, l1.texpaint, l1.texpaint_pack, slot_layer_get_opacity(l1), mask);
					}
				}
			}
		}
	}
}

function base_flatten(height_to_normal: bool = false, layers: slot_layer_t[] = null): slot_layer_t {
	base_ext_flatten(height_to_normal, layers);
}

function base_on_layers_resized() {
	base_ext_on_layers_resized();
}
