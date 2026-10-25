-- Update stale .png asset paths to .webp after image optimization
UPDATE spotvault_environment_assets
  SET file_path = REPLACE(file_path, '.png', '.webp')
  WHERE file_path LIKE '%.png';

UPDATE spotvault_environment_assets
  SET src = REPLACE(src, '.png', '.webp')
  WHERE src LIKE '%.png';

UPDATE spotvault_environment_assets
  SET file_name = REPLACE(file_name, '.png', '.webp')
  WHERE file_name LIKE '%.png';