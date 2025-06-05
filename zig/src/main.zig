const std = @import("std");
const parser = @import("parser.zig");

fn usage() void {
    std.debug.print("Usage: webir-zig <command> [options]\n", .{});
    std.debug.print("Commands: extract, interfaces, validate\n", .{});
}

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer std.debug.assert(!gpa.deinit());
    const allocator = gpa.allocator();

    var args = std.process.args();
    _ = args.skip(); // skip program name
    const cmd = args.next() orelse {
        usage();
        return;
    };

    if (std.mem.eql(u8, cmd, "extract")) {
        const path = "node_modules/typescript/lib/lib.dom.d.ts";
        var ir = try parser.parseDomTypes(allocator, path);
        var out_stream = std.io.getStdOut().writer();
        if (args.next()) |opt_path| {
            var file = try std.fs.cwd().createFile(opt_path, .{});
            out_stream = file.writer();
        }
        var json = std.json.StringifyOptions{};
        try out_stream.writeAll("{\n");
        for (ir.items) |iface, idx| {
            try out_stream.print("  \"{s}\": [\n", .{iface.name});
            for (iface.entries.items) |entry, jdx| {
                switch (entry) {
                    .method => |m| {
                        try out_stream.print("    {{\"interface\":\"{s}\",\"kind\":\"method\",\"name\":\"{s}\",\"parameters\":[", .{ m.interface, m.name });
                        for (m.parameters) |p, kdx| {
                            if (kdx > 0) try out_stream.writeAll(",");
                            try out_stream.print("{{\"name\":\"{s}\",\"type\":\"{s}\",\"optional\":{?},\"rest\":{?}}}", .{ p.name, p.ty, p.optional, p.rest });
                        }
                        try out_stream.print("],\"arity\":{},\"required\":{},\"returnType\":\"{s}\"}}", .{ m.parameters.len, calcRequired(m.parameters), m.return_type });
                    },
                    .property => |p| {
                        const kind = if (p.is_event) "event" else "property";
                        try out_stream.print("    {{\"interface\":\"{s}\",\"kind\":\"{s}\",\"name\":\"{s}\",\"type\":\"{s}\"}}", .{ p.interface, kind, p.name, p.ty });
                    },
                }
                if (jdx + 1 < iface.entries.items.len) try out_stream.writeAll(",");
                try out_stream.writeAll("\n");
            }
            try out_stream.writeAll("  ]");
            if (idx + 1 < ir.items.len) try out_stream.writeAll(",");
            try out_stream.writeAll("\n");
        }
        try out_stream.writeAll("}\n");
    } else if (std.mem.eql(u8, cmd, "interfaces")) {
        const path = "node_modules/typescript/lib/lib.dom.d.ts";
        var ir = try parser.parseDomTypes(allocator, path);
        for (ir.items) |iface| {
            std.debug.print("{s}\n", .{ iface.name });
        }
    } else if (std.mem.eql(u8, cmd, "validate")) {
        const file_path = args.next() orelse "-";
        var in_stream = std.io.getStdIn().reader();
        if (!std.mem.eql(u8, file_path, "-")) {
            var file = try std.fs.cwd().openFile(file_path, .{});
            in_stream = file.reader();
        }
        var buf = std.ArrayList(u8).init(allocator);
        defer buf.deinit();
        try in_stream.readAllToEndAlloc(allocator, 16 * 1024 * 1024, &buf);
        var parsed = std.json.parseFromSlice(std.json.Value, allocator, buf.items, .{}) catch {
            std.debug.print("Invalid JSON\n", .{});
            return error.InvalidJson;
        };
        _ = parsed; // TODO: schema validation
        std.debug.print("Validation not implemented, JSON parsed successfully\n", .{});
    } else {
        usage();
    }
}

fn calcRequired(params: []parser.Parameter) u32 {
    var count: u32 = 0;
    for (params) |p| if (!p.optional) count += 1;
    return count;
}
