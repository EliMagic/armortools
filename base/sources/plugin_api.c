
#include <string.h>
#include <stdbool.h>
#include "quickjs/quickjs.h"
#include "quickjs/quickjs-libc.h"
#include "zui.h"
#include "iron_array.h"

extern JSRuntime *js_runtime;
extern JSContext *js_ctx;
void js_call(void *p);
void js_call_arg(void *p, int argc, void *argv);

#define MAKE_FN(name)\
    static JSValue js_##name(JSContext *ctx, JSValue this_val, int argc, JSValue *argv)

#define MAKE_VOID_FN(name)\
    void name();\
    MAKE_FN(name) {\
        name();\
        return JS_UNDEFINED;\
    }

#define MAKE_PTR_FN(name)\
    void *name();\
    MAKE_FN(name) {\
        int64_t result = (int64_t)name();\
        return JS_NewInt64(ctx, result);\
    }

#define MAKE_VOID_FN_STR(name)\
    void name(char *s);\
    MAKE_FN(name) {\
        char *s = (char *)JS_ToCString(ctx, argv[0]);\
        name(s);\
        return JS_UNDEFINED;\
    }

#define MAKE_VOID_FN_PTR_CB(name)\
    void name(void *p0, void *p1);\
    MAKE_FN(name) {\
        int64_t p0;\
        JS_ToInt64(ctx, &p0, argv[0]);\
        JSValue *p1 = malloc(sizeof(JSValue));\
        JSValue dup = JS_DupValue(ctx, argv[1]);\
        memcpy(p1, &dup, sizeof(JSValue));\
        name((void *)p0, p1);\
        return JS_UNDEFINED;\
    }

#define BIND_FN(name, argc)\
    JS_SetPropertyStr(js_ctx, global_obj, #name, JS_NewCFunction(js_ctx, js_##name, #name, argc))

// These could be auto-generated by alang
MAKE_VOID_FN_STR(console_log)
MAKE_VOID_FN_STR(console_info)
MAKE_PTR_FN(plugin_create)
MAKE_VOID_FN_PTR_CB(plugin_notify_on_ui)

static JSObject *ui_files_cb;
static void ui_files_done(char *path) {
    JSValue path_val = JS_NewString(js_ctx, path);
    JSValue argv[] = { path_val };
    js_call_arg(ui_files_cb, 1, argv);
}

void ui_files_show(char *s, bool b0, bool b1, void(*f)(char *));
MAKE_FN(ui_files_show) {
    char *filters = (char *)JS_ToCString(ctx, argv[0]);
    bool is_save = JS_ToBool(ctx, argv[1]);
    bool open_multiple = JS_ToBool(ctx, argv[2]);
    ui_files_cb = malloc(sizeof(JSValue));
    JSValue dup = JS_DupValue(ctx, argv[3]);
    memcpy(ui_files_cb, &dup, sizeof(JSValue));
    ui_files_show(filters, is_save, open_multiple, ui_files_done);
    return JS_UNDEFINED;
}

void *data_get_blob(char *s);
MAKE_FN(data_get_blob) {
    char *s = (char *)JS_ToCString(ctx, argv[0]);
    buffer_t *b = data_get_blob(s);
    JSValue val = JS_NewArrayBuffer(ctx, b->buffer, b->length, NULL, NULL, 0);
    return val;
}

void *krom_file_save_bytes(char *s, buffer_t *b, int l);
MAKE_FN(krom_file_save_bytes) {
    char *to = (char *)JS_ToCString(ctx, argv[0]);
    int64_t len;
    void *ab = JS_GetArrayBuffer(ctx, &len, argv[1]);
    buffer_t b = { .buffer = ab, .length = len, .capacity = len };
    krom_file_save_bytes(to, &b, len);
    return JS_UNDEFINED;
}

MAKE_FN(zui_handle_create) {
    int64_t result = (int64_t)zui_handle_create();
    return JS_NewInt64(ctx, result);
}

MAKE_FN(zui_panel) {
    int64_t p;
    JS_ToInt64(ctx, &p, argv[0]);
    char *s = (char *)JS_ToCString(ctx, argv[1]);
    bool result = zui_panel((void *)p, s, false, false);
    return JS_NewBool(ctx, result);
}

MAKE_FN(zui_button) {
    char *s = (char *)JS_ToCString(ctx, argv[0]);
    bool result = zui_button(s, ZUI_ALIGN_CENTER, "");
    return JS_NewBool(ctx, result);
}

MAKE_FN(zui_text) {
    char *s = (char *)JS_ToCString(ctx, argv[0]);
    zui_text(s, ZUI_ALIGN_LEFT, 0);
    return JS_UNDEFINED;
}

MAKE_FN(zui_text_input) {
    int64_t p;
    JS_ToInt64(ctx, &p, argv[0]);
    char *s = (char *)JS_ToCString(ctx, argv[1]);
    zui_text_input((void *)p, s, ZUI_ALIGN_LEFT, true, false);
    return JS_UNDEFINED;
}

MAKE_FN(zui_slider) {
    int64_t p;
    JS_ToInt64(ctx, &p, argv[0]);
    char *s = (char *)JS_ToCString(ctx, argv[1]);
    zui_slider((void *)p, s, 0, 1, true, 100, true, ZUI_ALIGN_LEFT, true);
    return JS_UNDEFINED;
}

MAKE_FN(zui_check) {
    int64_t p;
    JS_ToInt64(ctx, &p, argv[0]);
    char *s = (char *)JS_ToCString(ctx, argv[1]);
    zui_check((void *)p, s, "");
    return JS_UNDEFINED;
}

MAKE_FN(zui_radio) {
    int64_t p;
    JS_ToInt64(ctx, &p, argv[0]);
    int32_t pos;
    JS_ToInt32(ctx, &pos, argv[1]);
    char *s = (char *)JS_ToCString(ctx, argv[2]);
    zui_radio((void *)p, pos, s, "");
    return JS_UNDEFINED;
}

MAKE_FN(zui_row) {
    JSValue val_len = JS_GetPropertyStr(ctx, argv[0], "length");
    int len;
    JS_ToInt32(ctx, &len, val_len);
    f32_array_t *ratios = f32_array_create(len);
    for (int i = 0; i < len; ++i) {
        JSValue val = JS_GetPropertyUint32(ctx, argv[0], i);
        double f;
        JS_ToFloat64(ctx, &f, val);
        ratios->buffer[i] = f;
    }
    zui_row(ratios);
    return JS_UNDEFINED;
}

MAKE_FN(zui_combo) {
    int64_t p;
    JS_ToInt64(ctx, &p, argv[0]);

    JSValue val_len = JS_GetPropertyStr(ctx, argv[1], "length");
    int len;
    JS_ToInt32(ctx, &len, val_len);
    char_ptr_array_t *texts = any_array_create(len);
    for (int i = 0; i < len; ++i) {
        JSValue val = JS_GetPropertyUint32(ctx, argv[1], i);
        char *s = (char *)JS_ToCString(ctx, val);
        texts->buffer[i] = s;
    }

    char *label = (char *)JS_ToCString(ctx, argv[2]);

    zui_combo((void *)p, texts, label, true, ZUI_ALIGN_LEFT, true);
    return JS_UNDEFINED;
}

void plugin_api_init() {
    JSValue global_obj = JS_GetGlobalObject(js_ctx);

    BIND_FN(console_log, 1);
    BIND_FN(console_info, 1);
    BIND_FN(plugin_create, 0);
    BIND_FN(plugin_notify_on_ui, 2);
    BIND_FN(ui_files_show, 4);
    BIND_FN(data_get_blob, 1);
    BIND_FN(krom_file_save_bytes, 3);

    BIND_FN(zui_handle_create, 0);
    BIND_FN(zui_panel, 2);
    BIND_FN(zui_button, 1);
    BIND_FN(zui_text, 1);
    BIND_FN(zui_text_input, 2);
    BIND_FN(zui_slider, 5);
    BIND_FN(zui_check, 2);
    BIND_FN(zui_radio, 3);
    BIND_FN(zui_row, 1);
    BIND_FN(zui_combo, 3);

    JS_FreeValue(js_ctx, global_obj);
}
