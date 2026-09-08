import SparkMD5 from 'spark-md5';

// Google Drive stores an MD5 checksum for every binary file, so hashing the
// picked file locally lets us detect an exact duplicate before uploading.
// Hashing huge files is slow, so we cap it and fall back to name+size matching.
export const MD5_MAX_SIZE = 150 * 1024 * 1024; // 150 MB

export const fileMd5 = async (file: File): Promise<string | null> => {
  if (file.size > MD5_MAX_SIZE) return null;
  const chunkSize = 4 * 1024 * 1024;
  const spark = new SparkMD5.ArrayBuffer();
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    const buf = await file.slice(offset, Math.min(offset + chunkSize, file.size)).arrayBuffer();
    spark.append(buf);
  }
  return spark.end();
};

export type ExistingFile = { name: string; size: number; md5?: string };

export const findDuplicate = (
  file: File,
  md5: string | null,
  existing: ExistingFile[],
): { match: ExistingFile; exact: boolean } | null => {
  if (md5) {
    const exact = existing.find((e) => e.md5 && e.md5 === md5);
    if (exact) return { match: exact, exact: true };
  }
  const likely = existing.find((e) => e.name === file.name && e.size === file.size);
  return likely ? { match: likely, exact: false } : null;
};
