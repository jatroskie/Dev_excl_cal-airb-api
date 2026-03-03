import requests
from bs4 import BeautifulSoup
import pandas as pd
import json

# Scrape SA Rugby players
def scrape_sa_rugby_players():
    url = "https://www.sarugby.co.za/sa-teams-players/springboks/"
    headers = {'User-Agent': 'Mozilla/5.0'}
    response = requests.get(url, headers=headers)
    soup = BeautifulSoup(response.text, 'html.parser')
    players = []
    for player_div in soup.find_all('div', class_='player-card'):  # Adjust class based on site HTML
        name = player_div.find('h3').text.strip()
        position = player_div.find('span', class_='position').text.strip()
        caps = player_div.find('span', class_='caps').text.strip()
        debut = player_div.find('span', class_='debut').text.strip()
        bio = player_div.find('p', class_='bio').text.strip()
        players.append({
            'name': name,
            'position': position,
            'caps': caps,
            'debut': debut,
            'bio': bio
        })
    return players

# Scrape SA Rugby matches
def scrape_sa_rugby_matches():
    url = "https://www.sarugby.co.za/fixtures-results/springboks/"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    matches = []
    for match_row in soup.find_all('tr', class_='match-row'):  # Adjust based on HTML
        date = match_row.find('td', class_='date').text.strip()
        opponent = match_row.find('td', class_='opponent').text.strip()
        score = match_row.find('td', class_='score').text.strip()
        result = match_row.find('td', class_='result').text.strip()
        venue = match_row.find('td', class_='venue').text.strip()
        matches.append({
            'date': date,
            'opponent': opponent,
            'score': score,
            'result': result,
            'venue': venue
        })
    return matches

# Scrape ESPN matches (historical)
def scrape_espn_matches():
    url = "https://www.espn.com/rugby/team/_/id/8/south-africa"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    matches = []
    for match in soup.find_all('div', class_='match-item'):
        date = match.find('span', class_='date').text.strip()
        opponent = match.find('span', class_='opponent').text.strip()
        score = match.find('span', class_='score').text.strip()
        result = match.find('span', class_='result').text.strip()
        venue = match.find('span', class_='venue').text.strip()
        matches.append({
            'date': date,
            'opponent': opponent,
            'score': score,
            'result': result,
            'venue': venue
        })
    return matches

# Run and save
sa_players = scrape_sa_rugby_players()
sa_matches = scrape_sa_rugby_matches()
espn_matches = scrape_espn_matches()

data = {
    'sa_rugby_players': sa_players,
    'sa_rugby_matches': sa_matches,
    'espn_matches': espn_matches  # More historical
}

with open('springbok_alternative_data.json', 'w') as f:
    json.dump(data, f, indent=4)

print("Data saved to springbok_alternative_data.json")