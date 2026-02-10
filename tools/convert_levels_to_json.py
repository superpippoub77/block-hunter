#!/usr/bin/env python3
"""
Convert level*.js files to level*.json format
"""

import os
import re
import json
from pathlib import Path

def parse_js_level_to_dict(js_content):
    """Parse JavaScript level object to Python dict"""
    
    # Extract the level ID
    id_match = re.search(r'window\.LEVELS\["([^"]+)"\]', js_content)
    if not id_match:
        return None
    
    level_id = id_match.group(1)
    
    # Extract the object content
    obj_match = re.search(r'window\.LEVELS\["[^"]+"\]\s*=\s*({[\s\S]*});', js_content)
    if not obj_match:
        return None
    
    obj_str = obj_match.group(1)
    
    # Clean up comments
    obj_str = re.sub(r'//.*$', '', obj_str, flags=re.MULTILINE)
    
    # Convert JS object notation to JSON
    # Handle property names without quotes
    obj_str = re.sub(r'(\w+):', r'"\1":', obj_str)
    
    # Handle single quotes to double quotes
    obj_str = obj_str.replace("'", '"')
    
    # Handle null values
    obj_str = obj_str.replace('null', 'null')
    
    # Remove trailing commas
    obj_str = re.sub(r',(\s*[}\]])', r'\1', obj_str)
    
    try:
        level_data = json.loads(obj_str)
        return level_data
    except json.JSONDecodeError as e:
        print(f"Error parsing level {level_id}: {e}")
        return None

def convert_levels():
    """Convert all level*.js files to level*.json"""
    
    # Get the script directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    level_dir = project_root / 'data' / 'level'
    
    if not level_dir.exists():
        print(f"Level directory not found: {level_dir}")
        return
    
    # Find all level*.js files
    js_files = sorted(level_dir.glob('level*.js'))
    
    converted_count = 0
    failed_count = 0
    
    for js_file in js_files:
        print(f"Converting {js_file.name}...", end=' ')
        
        try:
            # Read JS file
            with open(js_file, 'r', encoding='utf-8') as f:
                js_content = f.read()
            
            # Parse to dict
            level_data = parse_js_level_to_dict(js_content)
            
            if level_data:
                # Create JSON filename
                json_filename = js_file.stem + '.json'
                json_path = level_dir / json_filename
                
                # Write JSON file
                with open(json_path, 'w', encoding='utf-8') as f:
                    json.dump(level_data, f, indent=2)
                
                print(f"✓ Created {json_filename}")
                converted_count += 1
            else:
                print("✗ Failed to parse")
                failed_count += 1
                
        except Exception as e:
            print(f"✗ Error: {e}")
            failed_count += 1
    
    print(f"\nConversion complete: {converted_count} successful, {failed_count} failed")

if __name__ == '__main__':
    convert_levels()
