import os
import sys
import tempfile
import unittest

SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")
sys.path.insert(0, SCRIPTS_DIR)

import update_loc as u  # noqa: E402


class TestUpdateLoc(unittest.TestCase):
    def test_canonical_repo_key_normalizes_https_ssh_and_local(self):
        self.assertEqual(
            u.canonical_repo_key("D:\\Seleksi", "https://github.com/FitzzXYZ/Tugas-Kuliah-SPK.git"),
            "fitzzxyz/tugas-kuliah-spk",
        )
        self.assertEqual(
            u.canonical_repo_key("D:\\MyRepo", "git@github.com:FitzzXYZ/TUGAS-RPL-FIX.git"),
            "fitzzxyz/tugas-rpl-fix",
        )
        self.assertEqual(
            u.canonical_repo_key(r"C:\Temp\Pak Gondrong", ""),
            "local/pak gondrong",
        )

    def test_repo_map_aggregation_and_cache_roundtrip(self):
        repo_map = {
            "fitzzxyz/fitzzxyz": {"files": 10, "lines": 2000, "langs": {"TypeScript": 1500, "Go": 300, "Rust": 200}},
            "fitzzxyz/tugas-rpl-fix": {"files": 5, "lines": 500, "langs": {"TypeScript": 400, "CSS": 100}},
        }
        summary = u.build_summary_from_repo_map(repo_map)
        self.assertIsNotNone(summary)
        self.assertEqual(summary["total_lines"], 2500)
        self.assertEqual(summary["total_files"], 15)
        self.assertEqual(summary["total_repos"], 2)
        self.assertEqual(summary["total_langs"], 4)
        self.assertEqual(summary["languages"][0]["name"], "TypeScript")
        self.assertEqual(summary["languages"][0]["lines"], 1900)

        with tempfile.TemporaryDirectory() as tmp:
            cache_file = os.path.join(tmp, ".loc-cache.json")
            u.save_loc_cache(repo_map, cache_file)
            reloaded = u.load_loc_cache(cache_file)
            self.assertEqual(reloaded["fitzzxyz/tugas-rpl-fix"]["lines"], 500)

    def test_register_local_repo_persists_new_git_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            fake_repo = os.path.join(tmp, "BrandNewRepo")
            os.makedirs(os.path.join(fake_repo, ".git"))
            reg_file = os.path.join(tmp, "repos.json")
            self.assertTrue(u.register_local_repo(fake_repo, reg_file))
            self.assertFalse(u.register_local_repo(fake_repo, reg_file))
            loaded = u.load_registered_repos(reg_file)
            self.assertEqual(loaded, [os.path.normpath(os.path.abspath(fake_repo))])


if __name__ == "__main__":
    unittest.main()
