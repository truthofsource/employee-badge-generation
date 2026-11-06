import unittest
from lab.demo import report


class DemoTests(unittest.TestCase):
    def test_report(self):
        result = report()
        self.assertTrue(result["records"])
        self.assertTrue(all(item["passed"] for item in result["checks"]))
