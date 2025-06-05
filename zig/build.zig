const std = @import("std");

pub fn build(b: *std.Build) void {
    const mode = b.standardReleaseOptions();
    const exe = b.addExecutable(.{
        .name = "webir-zig",
        .root_source_file = .{ .path = "zig/src/main.zig" },
        .target = b.host,
        .optimize = mode,
    });
    b.installArtifact(exe);
}
