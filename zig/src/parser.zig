const std = @import("std");

pub const MethodEntry = struct {
    interface: []const u8,
    name: []const u8,
    parameters: []Parameter,
    return_type: []const u8,
};

pub const Parameter = struct {
    name: []const u8,
    ty: []const u8,
    optional: bool,
    rest: bool,
};

pub const PropertyEntry = struct {
    interface: []const u8,
    name: []const u8,
    ty: []const u8,
    is_event: bool,
};

pub const Entry = union(enum) {
    method: MethodEntry,
    property: PropertyEntry,
};

pub const InterfaceData = struct {
    name: []const u8,
    entries: std.ArrayList(Entry),
};

pub fn parseDomTypes(allocator: std.mem.Allocator, path: []const u8) !std.ArrayList(InterfaceData) {
    var file = try std.fs.cwd().openFile(path, .{});
    defer file.close();

    const data = try file.readToEndAlloc(allocator, 10 * 1024 * 1024); // 10MB

    var list = std.ArrayList(InterfaceData).init(allocator);

    var it = std.mem.tokenize(u8, data, "\n");

    var current: ?InterfaceData = null;

    while (it.next()) |line_| {
        const line = std.mem.trim(u8, line_, " \t");
        if (std.mem.startsWith(u8, line, "interface ")) {
            if (current) |c| {
                try list.append(c);
            }
            const after = line["interface ".len..];
            const name_end = std.mem.indexOfAny(u8, after, " {") orelse after.len;
            current = InterfaceData{
                .name = after[0..name_end],
                .entries = std.ArrayList(Entry).init(allocator),
            };
            continue;
        }
        if (std.mem.startsWith(u8, line, "}")) {
            if (current) |c| {
                try list.append(c);
                current = null;
            }
            continue;
        }
        if (current == null) continue;
        var c = current.*;
        // method
        if (std.mem.indexOfScalar(u8, line, '(')) |open_paren| {
            if (std.mem.indexOfScalar(u8, line, ')')) |close_paren| {
                if (close_paren < line.len) {
                    const name = std.mem.trim(u8, line[0..open_paren], " \t");
                    const param_str = line[open_paren+1 .. close_paren];
                    const after_paren = line[close_paren+1..];
                    const colon = std.mem.indexOfScalar(u8, after_paren, ':') orelse continue;
                    const ret = std.mem.trim(u8, after_paren[colon+1..], " ;");
                    var params = std.ArrayList(Parameter).init(allocator);
                    var pit = std.mem.tokenize(u8, param_str, ",");
                    while (pit.next()) |p_| {
                        const p = std.mem.trim(u8, p_, " \t");
                        if (p.len == 0) continue;
                        var rest = false;
                        var name_start: usize = 0;
                        if (std.mem.startsWith(u8, p, "...")) {
                            rest = true;
                            name_start = 3;
                        }
                        const colon_idx = std.mem.indexOfScalar(u8, p, ':') orelse continue;
                        const name_part = std.mem.trim(u8, p[name_start..colon_idx], " \t");
                        const type_part = std.mem.trim(u8, p[colon_idx+1..], " \t");
                        const optional = std.mem.indexOfScalar(u8, name_part, '?') != null;
                        const name_clean = name_part[0 .. name_part.len - (optional ? 1 : 0)];
                        try params.append(Parameter{
                            .name = name_clean,
                            .ty = type_part,
                            .optional = optional,
                            .rest = rest,
                        });
                    }
                    try c.entries.append(Entry{ .method = MethodEntry{
                        .interface = c.name,
                        .name = name,
                        .parameters = params.toOwnedSlice(),
                        .return_type = ret,
                    }});
                    current = c;
                    continue;
                }
            }
        } else if (std.mem.indexOfScalar(u8, line, ':')) |colon| {
            const name = std.mem.trim(u8, line[0..colon], " \t");
            const ty = std.mem.trim(u8, line[colon+1..], " ;");
            const is_event = std.mem.startsWith(u8, name, "on");
            try c.entries.append(Entry{ .property = PropertyEntry{
                .interface = c.name,
                .name = name,
                .ty = ty,
                .is_event = is_event,
            }});
            current = c;
            continue;
        }
    }
    if (current) |c| {
        try list.append(c);
    }
    return list;
}
