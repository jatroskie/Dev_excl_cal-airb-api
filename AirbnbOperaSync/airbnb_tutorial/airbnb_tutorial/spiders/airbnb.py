import scrapy


class AirbnbSpider(scrapy.Spider):
    name = "airbnb"
    allowed_domains = ["www.airbnb.com"]
    start_urls = ["https://www.airbnb.com"]

    def parse(self, response):
        pass
