
import argostranslate.package
import argostranslate.translate
import logging
import requests
import concurrent.futures

logger = logging.getLogger(__name__)

# Cache for file sizes: {url: size_bytes}
_SIZE_CACHE = {}

def _fetch_size(url):
    """Helper to fetch size with caching."""
    if url in _SIZE_CACHE:
        return _SIZE_CACHE[url]
    
    try:
        response = requests.head(url, allow_redirects=True, timeout=5)
        if response.status_code == 200:
            size = int(response.headers.get('content-length', 0))
            if size > 0:
                _SIZE_CACHE[url] = size
                return size
    except Exception:
        pass
    return 0

def get_available_languages():
    """
    Fetches all available Argos packages.
    Returns a list of dicts with package info.
    """
    try:
        # Update index to get latest packages
        argostranslate.package.update_package_index()
        available_packages = argostranslate.package.get_available_packages()
        
        # Prepare to fetch sizes in parallel
        # Get first link for each package
        urls = []
        for pkg in available_packages:
            url = pkg.links[0] if pkg.links else None
            urls.append(url)
            
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            sizes = list(executor.map(_fetch_size, [u for u in urls if u]))
            
        # Map back to results
        size_map = {u: s for u, s in zip([u for u in urls if u], sizes)}
        
        languages = []
        for pkg in available_packages:
            url = pkg.links[0] if pkg.links else None
            size = size_map.get(url, 0)
            
            languages.append({
                'from_code': pkg.from_code,
                'from_name': pkg.from_name,
                'to_code': pkg.to_code,
                'to_name': pkg.to_name,
                'package_version': pkg.package_version,
                'argos_version': pkg.argos_version,
                'size_bytes': size,
                'links': pkg.links
            })
        return languages
    except Exception as e:
        logger.error(f"Error fetching available languages: {e}")
        return []


def get_installed_languages():
    """
    Returns currently installed language packages.
    """
    try:
        installed_packages = argostranslate.package.get_installed_packages()
        languages = []
        for pkg in installed_packages:
            languages.append({
                'from_code': pkg.from_code,
                'from_name': pkg.from_name,
                'to_code': pkg.to_code,
                'to_name': pkg.to_name,
                'package_version': pkg.package_version
            })
        return languages
    except Exception as e:
        logger.error(f"Error fetching installed languages: {e}")
        return []

def install_language(from_code, to_code):
    """
    Downloads and installs a specific language pair.
    """
    try:
        argostranslate.package.update_package_index()
        available_packages = argostranslate.package.get_available_packages()
        package_to_install = next(
            filter(
                lambda x: x.from_code == from_code and x.to_code == to_code,
                available_packages
            ), None
        )
        
        if package_to_install:
            check_path = package_to_install.download()
            argostranslate.package.install_from_path(check_path)
            return True, f"Installed {from_code}->{to_code}"
        else:
            return False, "Package not found"
            
    except Exception as e:
        logger.error(f"Error installing language {from_code}->{to_code}: {e}")
        return False, str(e)

def uninstall_language(from_code, to_code):
    """
    Removes a language pair.
    """
    try:
        installed_packages = argostranslate.package.get_installed_packages()
        package_to_uninstall = next(
            filter(
                lambda x: x.from_code == from_code and x.to_code == to_code,
                installed_packages
            ), None
        )
        
        if package_to_uninstall:
            argostranslate.package.uninstall(package_to_uninstall)
            return True, f"Uninstalled {from_code}->{to_code}"
        else:
            return False, "Package not found in installed packages"
            
    except Exception as e:
        logger.error(f"Error uninstalling language {from_code}->{to_code}: {e}")
        return False, str(e)
