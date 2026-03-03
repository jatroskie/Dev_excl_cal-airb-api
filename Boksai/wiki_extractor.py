import requests
from bs4 import BeautifulSoup
import pandas as pd
import wikipediaapi
import json
import time
from io import StringIO  # For pandas read_html fix

# Initialize Wikipedia API (user-agent for compliance)
wiki = wikipediaapi.Wikipedia(
    language='en',
    user_agent='SpringbokScraper/1.0 (your.email@example.com)'
)

def fetch_page_content(page_title):
    page = wiki.page(page_title)
    if page.exists():
        return page.text
    else:
        print(f"Page '{page_title}' not found.")
        return None

def scrape_html_table(url):
    headers = {'User-Agent': 'SpringbokScraper/1.0 (your.email@example.com)'}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        tables = pd.read_html(StringIO(response.text))  # Fixed deprecated call
        return tables, soup
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return [], None

def scrape_player_infobox(url):
    headers = {'User-Agent': 'SpringbokScraper/1.0 (your.email@example.com)'}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, 'html.parser')
        
        infobox = soup.find('table', class_='infobox')
        if not infobox:
            print(f"No infobox found for {url}")
            return None
        
        player_data = {'url': url}
        
        rows = infobox.find_all('tr')
        current_section = None
        for row in rows:
            th = row.find('th')
            td = row.find('td')
            if th and td:
                label = th.text.strip().lower()
                value = td.text.strip().replace('\n', ' ').strip()
                
                if 'full name' in label:
                    player_data['full_name'] = value
                elif 'birth name' in label:
                    player_data['full_name'] = value
                elif 'date of birth' in label:
                    player_data['date_of_birth'] = value
                elif 'place of birth' in label:
                    player_data['place_of_birth'] = value
                elif 'height' in label:
                    player_data['height'] = value
                elif 'weight' in label:
                    player_data['weight'] = value
                elif 'school' in label:
                    player_data['school'] = value
                elif 'university' in label:
                    player_data['university'] = value
                elif 'position' in label:
                    player_data['positions'] = value
                elif 'current team' in label:
                    player_data['current_team'] = value
                if 'youth career' in label:
                    current_section = 'youth_career'
                    player_data[current_section] = td.get_text(separator=' | ').strip()
                elif 'amateur team' in label:
                    current_section = 'amateur_teams'
                    player_data[current_section] = td.get_text(separator=' | ').strip()
                elif 'senior career' in label:
                    current_section = 'senior_career'
                    player_data[current_section] = td.get_text(separator=' | ').strip()
                elif 'international career' in label:
                    current_section = 'international_career'
                    player_data[current_section] = td.get_text(separator=' | ').strip()
                elif current_section and not label:
                    player_data[current_section] += ' | ' + td.get_text(separator=' | ').strip()
        
        intro = soup.find('div', class_='mw-parser-output').find('p')
        player_data['text_summary'] = intro.text.strip() if intro else ''
        
        return player_data
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return None

def save_checkpoint(data, filename='springbok_data_checkpoint.json'):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=4)
    print(f"Checkpoint saved to {filename}")

# Main scraping logic
data = {'team': {}, 'player_profiles': [], 'matches': [], 'records': []}

# Step 1: Team Info
print("Starting scrape: Fetching team info...")
team_page = 'South_Africa_national_rugby_union_team'
team_text = fetch_page_content(team_page)
data['team'] = {'title': team_page, 'full_text': team_text, 'summary': team_text[:1000] if team_text else ''}  
time.sleep(1)
print("Team info fetched.")
save_checkpoint(data)

# Step 2: Players - Scrape list for links, then individual profiles
print("Fetching players list...")
players_list_url = 'https://en.wikipedia.org/wiki/List_of_South_Africa_national_rugby_union_players'
_, players_list_soup = scrape_html_table(players_list_url)
if players_list_soup:
    table = players_list_soup.find('table', class_='wikitable')
    if table:
        rows = table.find_all('tr')[1:]  # All player rows
        total_rows = len(rows)
        print(f"Found {total_rows} potential player rows. Starting detailed scrape...")
        for i, row in enumerate(rows):
            cells = row.find_all('td')
            if cells and len(cells) > 1:
                name_cell = cells[1]
                link = name_cell.find('a')
                if link and 'redlink' not in link['href']:
                    player_url = 'https://en.wikipedia.org' + link['href']
                    print(f"Scraping player {i+1}/{total_rows}: {player_url}")
                    player_data = scrape_player_infobox(player_url)
                    if player_data:
                        player_data['springbok_number'] = cells[0].text.strip() if len(cells) > 0 else ''
                        player_data['name'] = name_cell.text.strip()
                        data['player_profiles'].append(player_data)
                    time.sleep(2)  # Polite delay
            # Save checkpoint every 50 players
            if (i + 1) % 50 == 0:
                save_checkpoint(data)
                print(f"Processed {i + 1}/{total_rows} players.")
print(f"Player profiles scrape complete: {len(data['player_profiles'])} profiles collected.")
save_checkpoint(data)

# Step 3: Matches
print("Fetching matches...")
matches_url = 'https://en.wikipedia.org/wiki/List_of_South_Africa_rugby_union_test_matches'
match_tables, match_soup = scrape_html_table(matches_url)
if match_tables:
    total_tables = len(match_tables)
    for i, table in enumerate(match_tables):
        print(f"Processing match table {i+1}/{total_tables}")
        for _, row in table.iterrows():
            match = {('_'.join(map(str, k)) if isinstance(k, tuple) else str(k)): v for k, v in row.to_dict().items()}  # Flatten tuple keys
            match['text_summary'] = f"Match on {match.get('Date', 'N/A')} vs {match.get('Opponent', 'N/A')}, score {match.get('Score', 'N/A')} at {match.get('Venue', 'N/A')}."
            data['matches'].append(match)
    time.sleep(1)
print(f"Matches fetched: {len(data['matches'])} matches.")
save_checkpoint(data)

# Step 4: Stats/Records
print("Fetching records...")
records_url = 'https://en.wikipedia.org/wiki/List_of_South_Africa_national_rugby_union_team_records'
records_tables, _ = scrape_html_table(records_url)
if records_tables:
    total_tables = len(records_tables)
    for i, table in enumerate(records_tables):
        print(f"Processing records table {i+1}/{total_tables}")
        for _, row in table.iterrows():
            record = {('_'.join(map(str, k)) if isinstance(k, tuple) else str(k)): v for k, v in row.to_dict().items()}  # Flatten tuple keys
            record['text_summary'] = f"Record: {record.get('Player', 'N/A')} with {record.get('Points', 'N/A')} points or similar stat."
            data['records'].append(record)
    time.sleep(1)
print(f"Records fetched: {len(data['records'])} records.")

# Final save
with open('springbok_data.json', 'w') as f:
    json.dump(data, f, indent=4)

print("Data scraped and stored in 'springbok_data.json'.")
print(f"Scraped {len(data['player_profiles'])} detailed player profiles.")
print("Scraping complete!")