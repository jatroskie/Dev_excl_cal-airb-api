import csv

input_file = 'conversations.csv'
output_file = 'filtered_conversations.csv'

with open(input_file, 'r', encoding='utf-8') as csvfile:
    reader = csv.reader(csvfile)
    header = next(reader)  # Read the header row

    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile_out:
        writer = csv.writer(csvfile_out)
        writer.writerow(header)  # Write the header row to the output file

        for row in reader:
            if row[5].strip():  # Check if the 'Text' column (index 5) is not empty
                writer.writerow(row)
                