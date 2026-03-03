# First, install Scrapy if not already: pip install scrapy
# Then, create a new Scrapy project: scrapy startproject bokhist_scraper
# Navigate to the project: cd bokhist_scraper
# Create a spider file: touch bokhist_scraper/spiders/bokhist.py
# Replace the contents of bokhist.py with the code below.
# Also, update settings.py to add: USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
# And: DOWNLOAD_DELAY = 1  # To avoid overloading the site
# For output, we'll use JSONLines: FEEDS = {'data.jl': {'format': 'jsonlines'}}

import scrapy
from scrapy.http import Request
from urllib.parse import urljoin
import re

class BokhistSpider(scrapy.Spider):
    name = 'bokhist'
    allowed_domains = ['bokhist.com']
    start_urls = ['https://bokhist.com/']  # Start from main page to crawl links

    def __init__(self, mode='full', *args, **kwargs):
        super(BokhistSpider, self).__init__(*args, **kwargs)
        self.mode = mode  # 'sample' or 'full'
        self.max_player_id = 10 if mode == 'sample' else 1000
        self.max_tour_id = 5 if mode == 'sample' else 100
        self.max_game_id = 10 if mode == 'sample' else 1000
        self.max_stadium_id = 5 if mode == 'sample' else 200
        self.max_coach_id = 5 if mode == 'sample' else 50
        self.max_referee_id = 5 if mode == 'sample' else 200
        self.max_province_id = 5 if mode == 'sample' else 50
        self.max_school_id = 5 if mode == 'sample' else 200
        self.max_place_id = 5 if mode == 'sample' else 200

    def start_requests(self):
        # Crawl main page for stat links, but also brute-force IDs for completeness
        for url in self.start_urls:
            yield Request(url, callback=self.parse_main)
        
        # Brute-force entity IDs
        base_url = 'https://bokhist.com/'
        for pid in range(1, self.max_player_id + 1):
            yield Request(urljoin(base_url, f'PlayerData.aspx?PlayerID={pid}'), callback=self.parse_player, errback=self.handle_error)
        for tid in range(1, self.max_tour_id + 1):
            yield Request(urljoin(base_url, f'TourData.aspx?TourID={tid}'), callback=self.parse_tour, errback=self.handle_error)
        for gid in range(1, self.max_game_id + 1):
            yield Request(urljoin(base_url, f'GameData.aspx?GameID={gid}'), callback=self.parse_game, errback=self.handle_error)
        for sid in range(1, self.max_stadium_id + 1):
            yield Request(urljoin(base_url, f'StadiumData.aspx?StadiumID={sid}'), callback=self.parse_stadium, errback=self.handle_error)
        for cid in range(1, self.max_coach_id + 1):
            yield Request(urljoin(base_url, f'CoachData.aspx?CoachID={cid}'), callback=self.parse_coach, errback=self.handle_error)
        for rid in range(1, self.max_referee_id + 1):
            yield Request(urljoin(base_url, f'RefereeData.aspx?RefereeID={rid}'), callback=self.parse_referee, errback=self.handle_error)
        for prid in range(1, self.max_province_id + 1):
            yield Request(urljoin(base_url, f'ProvinceData.aspx?ProvinceID={prid}'), callback=self.parse_province, errback=self.handle_error)
        for schid in range(1, self.max_school_id + 1):
            yield Request(urljoin(base_url, f'SchoolData.aspx?SchoolID={schid}'), callback=self.parse_school, errback=self.handle_error)
        for plid in range(1, self.max_place_id + 1):
            yield Request(urljoin(base_url, f'PlaceData.aspx?PlaceID={plid}'), callback=self.parse_place, errback=self.handle_error)

    def parse_main(self, response):
        # Extract links to stat pages, tours, etc.
        for href in response.css('a::attr(href)').getall():
            if href.endswith('.aspx'):
                yield response.follow(href, callback=self.parse_generic)

    def parse_generic(self, response):
        # For stat pages, extract linked entities (e.g., players, matches)
        for href in response.css('a::attr(href)').getall():
            if 'PlayerData' in href:
                yield response.follow(href, callback=self.parse_player)
            elif 'GameData' in href:
                yield response.follow(href, callback=self.parse_game)
            elif 'TourData' in href:
                yield response.follow(href, callback=self.parse_tour)
            elif 'StadiumData' in href:
                yield response.follow(href, callback=self.parse_stadium)
            elif 'CoachData' in href:
                yield response.follow(href, callback=self.parse_coach)
            elif 'RefereeData' in href:
                yield response.follow(href, callback=self.parse_referee)
            elif 'ProvinceData' in href:
                yield response.follow(href, callback=self.parse_province)
            elif 'SchoolData' in href:
                yield response.follow(href, callback=self.parse_school)
            elif 'PlaceData' in href:
                yield response.follow(href, callback=self.parse_place)

    def parse_player(self, response):
        if response.status != 200:
            return
        player = {
            'type': 'player',
            'player_id': re.search(r'PlayerID=(\d+)', response.url).group(1),
            'full_name': response.xpath('//text()[contains(., "Full names:")]/following-sibling::text()').get(default='').strip(),
            'dob': response.xpath('//text()[contains(., "Date of birth:")]/following-sibling::text()').get(default='').strip(),
            'place_of_birth': response.xpath('//text()[contains(., "Place of birth:")]/following-sibling::text()').get(default='').strip(),
            'height': response.xpath('//text()[contains(., "Height:")]/following-sibling::text()').get(default='').strip(),
            'weight': response.xpath('//text()[contains(., "Weight:")]/following-sibling::text()').get(default='').strip(),
            'school': response.xpath('//text()[contains(., "School:")]/following-sibling::text()').get(default='').strip(),
            'university': response.xpath('//text()[contains(., "University:")]/following-sibling::text()').get(default='').strip(),
            'debut_province': response.xpath('//text()[contains(., "Debut province:")]/following-sibling::text()').get(default='').strip(),
            'springbok_no': response.xpath('//text()[contains(., "Springbok no:")]/following-sibling::text()').get(default='').strip(),
            'total_tests': response.xpath('//text()[contains(., "Total tests:")]/following-sibling::text()').get(default='').strip(),
            'total_tries': response.xpath('//text()[contains(., "Total tries:")]/following-sibling::text()').get(default='').strip(),
            'first_game_id': response.css('table tr td a[href*="GameData"]:first-child::attr(href)').re_first(r'GameID=(\d+)'),
            'last_game_id': response.css('table tr td a[href*="GameData"]:last-child::attr(href)').re_first(r'GameID=(\d+)'),
            'match_history': response.css('table tr td a[href*="GameData"]::attr(href)').re(r'GameID=(\d+)'),
            'text_summary': ' '.join(response.css('body::text').getall()).strip()  # For RAG
        }
        yield player

    def parse_tour(self, response):
        if response.status != 200:
            return
        tour = {
            'type': 'tour',
            'tour_id': re.search(r'TourID=(\d+)', response.url).group(1),
            'name': response.css('h2::text').get(default='').strip(),
            'year': response.xpath('//text()[contains(., "Year:")]/following-sibling::text()').get(default='').strip(),
            'captain_id': response.css('a[href*="PlayerData"]::attr(href)').re_first(r'PlayerID=(\d+)'),  # Assuming first player link is captain
            'coach_id': response.css('a[href*="CoachData"]::attr(href)').re_first(r'CoachID=(\d+)'),
            'squad': response.css('a[href*="PlayerData"]::attr(href)').re(r'PlayerID=(\d+)'),  # List of player_ids
            'matches': response.css('table tr td a[href*="GameData"]::attr(href)').re(r'GameID=(\d+)'),
            'text_summary': ' '.join(response.css('body::text').getall()).strip()
        }
        # Follow squad player links if not already crawled
        for href in response.css('a[href*="PlayerData"]::attr(href)').getall():
            yield response.follow(href, callback=self.parse_player)
        yield tour

    def parse_game(self, response):
        if response.status != 200:
            return
        game = {
            'type': 'match',
            'game_id': re.search(r'GameID=(\d+)', response.url).group(1),
            'date': response.xpath('//text()[contains(., "Date:")]/following-sibling::text()').get(default='').strip(),
            'opponent': response.xpath('//text()[contains(., "vs")]/following-sibling::text()').get(default='').strip(),
            'result': response.xpath('//text()[contains(., "Result:")]/following-sibling::text()').get(default='').strip(),
            'sa_score': int(response.xpath('//text()[contains(., "Score:")]/following-sibling::text()').get(default='0-0').split('-')[0].strip()),
            'opp_score': int(response.xpath('//text()[contains(., "Score:")]/following-sibling::text()').get(default='0-0').split('-')[1].strip()),
            'venue_id': response.css('a[href*="StadiumData"]::attr(href)').re_first(r'StadiumID=(\d+)'),
            'tour_id': response.css('a[href*="TourData"]::attr(href)').re_first(r'TourID=(\d+)'),
            'captain_id': response.css('a[href*="PlayerData"][contains(., "Captain:")]/::attr(href)').re_first(r'PlayerID=(\d+)'),  # Adjust if not exact
            'coach_id': response.css('a[href*="CoachData"]::attr(href)').re_first(r'CoachID=(\d+)'),
            'referee_id': response.css('a[href*="RefereeData"]::attr(href)').re_first(r'RefereeID=(\d+)'),
            'attendance': int(response.xpath('//text()[contains(., "Attendance:")]/following-sibling::text()').get(default='0').strip()),
            'starting_lineup': self.extract_lineup(response, 'Starting XV'),  # Custom method
            'reserves': self.extract_lineup(response, 'Reserves'),
            'scoring_events': self.extract_scoring_events(response),
            'text_summary': ' '.join(response.css('body::text').getall()).strip()
        }
        # Follow player links, etc.
        for href in response.css('a[href*="PlayerData"]::attr(href)').getall():
            yield response.follow(href, callback=self.parse_player)
        yield game

    def extract_lineup(self, response, lineup_type):
        # Extract starting or reserves lineup from tables
        lineup = []
        # Find the table containing the lineup_type text
        table = response.xpath(f'//table[contains(., "{lineup_type}")]')
        if table:
            rows = table.xpath('tr[position() > 1]')  # Skip header
            for row in rows:
                cells = row.xpath('td')
                if cells:
                    lineup.append({
                        'position': cells[0].xpath('text()').get(default='').strip(),
                        'player_id': cells[1].css('a[href*="PlayerData"]::attr(href)').re_first(r'PlayerID=(\d+)'),
                        'province_id': cells[2].css('a[href*="ProvinceData"]::attr(href)').re_first(r'ProvinceID=(\d+)'),
                        'age': int(cells[3].xpath('text()').get(default='0').strip()),
                        'prev_tests': int(cells[4].xpath('text()').get(default='0').strip()),
                        'scoring': cells[5].xpath('text()').get(default='').strip()
                    })
        return lineup

    def extract_scoring_events(self, response):
        events = []
        # Assume scoring events are in a list or table after "Scoring:"
        scoring_rows = response.xpath('//table[contains(., "Scoring events:")]/tr[position() > 1]')
        for row in scoring_rows:
            cells = row.xpath('td/text()').getall()
            if cells:
                events.append({
                    'time': cells[0].strip(),
                    'player_id': row.css('a[href*="PlayerData"]::attr(href)').re_first(r'PlayerID=(\d+)'),
                    'type': cells[1].strip(),
                    'points': int(cells[2].strip() if len(cells) > 2 else 0)
                })
        return events

    def parse_stadium(self, response):
        if response.status != 200:
            return
        stadium = {
            'type': 'stadium',
            'stadium_id': re.search(r'StadiumID=(\d+)', response.url).group(1),
            'name': response.xpath('//text()[contains(., "Name:")]/following-sibling::text()').get(default='').strip(),
            'location': response.xpath('//text()[contains(., "Location:")]/following-sibling::text()').get(default='').strip(),
            'games': response.css('a[href*="GameData"]::attr(href)').re(r'GameID=(\d+)'),
            'text_summary': ' '.join(response.css('body::text').getall()).strip()
        }
        yield stadium

    def parse_coach(self, response):
        if response.status != 200:
            return
        coach = {
            'type': 'coach',
            'coach_id': re.search(r'CoachID=(\d+)', response.url).group(1),
            'name': response.xpath('//text()[contains(., "Name:")]/following-sibling::text()').get(default='').strip(),
            'stint': response.xpath('//text()[contains(., "Stint:")]/following-sibling::text()').get(default='').strip(),
            'tests_coached': response.xpath('//text()[contains(., "Tests coached:")]/following-sibling::text()').get(default='').strip(),
            'text_summary': ' '.join(response.css('body::text').getall()).strip()
        }
        yield coach

    def parse_referee(self, response):
        if response.status != 200:
            return
        referee = {
            'type': 'referee',
            'referee_id': re.search(r'RefereeID=(\d+)', response.url).group(1),
            'name': response.xpath('//text()[contains(., "Name:")]/following-sibling::text()').get(default='').strip(),
            'country': response.xpath('//text()[contains(., "Country:")]/following-sibling::text()').get(default='').strip(),
            'matches_refereed': response.css('a[href*="GameData"]::attr(href)').re(r'GameID=(\d+)'),
            'text_summary': ' '.join(response.css('body::text').getall()).strip()
        }
        yield referee

    def parse_province(self, response):
        if response.status != 200:
            return
        province = {
            'type': 'province',
            'province_id': re.search(r'ProvinceID=(\d+)', response.url).group(1),
            'name': response.xpath('//text()[contains(., "Name:")]/following-sibling::text()').get(default='').strip(),
            'players': response.css('a[href*="PlayerData"]::attr(href)').re(r'PlayerID=(\d+)'),
            'text_summary': ' '.join(response.css('body::text').getall()).strip()
        }
        yield province

    def parse_school(self, response):
        if response.status != 200:
            return
        school = {
            'type': 'school',
            'school_id': re.search(r'SchoolID=(\d+)', response.url).group(1),
            'name': response.xpath('//text()[contains(., "Name:")]/following-sibling::text()').get(default='').strip(),
            'players': response.css('a[href*="PlayerData"]::attr(href)').re(r'PlayerID=(\d+)'),
            'text_summary': ' '.join(response.css('body::text').getall()).strip()
        }
        yield school

    def parse_place(self, response):
        if response.status != 200:
            return
        place = {
            'type': 'place',
            'place_id': re.search(r'PlaceID=(\d+)', response.url).group(1),
            'name': response.xpath('//text()[contains(., "Name:")]/following-sibling::text()').get(default='').strip(),
            'players_born': response.css('a[href*="PlayerData"]::attr(href)').re(r'PlayerID=(\d+)'),
            'text_summary': ' '.join(response.css('body::text').getall()).strip()
        }
        yield place

    def handle_error(self, failure):
        pass  # Ignore missing IDs