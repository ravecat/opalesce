import { ArtifactError } from "./errors.js";
import type { GeneratedArtifact } from "./types.js";

function isCanonicalArtifactPath(path: string): boolean {
  if (
    path.length === 0 ||
    path.includes("\\") ||
    path.includes("\0") ||
    path.startsWith("/") ||
    /^[A-Za-z]:\//u.test(path)
  ) {
    return false;
  }

  return path
    .split("/")
    .every((segment) => segment.length > 0 && segment !== "." && segment !== "..");
}

export class ArtifactStore {
  private readonly artifacts: GeneratedArtifact[] = [];
  private readonly paths = new Set<string>();

  add(artifact: GeneratedArtifact): void {
    if (!isCanonicalArtifactPath(artifact.path)) {
      throw new ArtifactError("invalid-path", artifact.path);
    }

    if (this.paths.has(artifact.path)) {
      throw new ArtifactError("path-collision", artifact.path);
    }

    const storedArtifact = Object.freeze({
      path: artifact.path,
      contents: artifact.contents,
    });

    this.paths.add(storedArtifact.path);
    this.artifacts.push(storedArtifact);
  }

  snapshot(): readonly GeneratedArtifact[] {
    return Object.freeze([...this.artifacts]);
  }
}
