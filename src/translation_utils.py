import argostranslate.package
import argostranslate.translate


from language_manager import get_installed_languages, install_language

def install_languages():
    """
    Deprecated: Use language_manager.install_language instead.
    This function is kept for backward compatibility but does nothing by default now
    to avoid blocking startup with downloads.
    """
    pass


def translate_text(text, target_lang, source_lang='en'):
    """Translates text between two ISO language codes using Argos Translate.

    Args:
        text (str): The string content to translate.
        target_lang (str): ISO code of the target language.
        source_lang (str): ISO code of the source language. Defaults to 'en'.

    Returns:
        str: The translated text, or the original text if translation fails.
    """
    try:
        if source_lang == target_lang:
            return text
            
        if source_lang in ['multilingual', 'auto', 'none']:
            # TODO: Implement language detection. For now, default to English or fail gracefully.
            # Returning original text might be safer if we can't detect, but user expects translation.
            # Let's try English default since most users might be translating FROM English.
            print(f"Warning: Source language '{source_lang}' not supported by manual translation. Defaulting to 'en'.")
            source_lang = 'en'
            
        return argostranslate.translate.translate(text, source_lang, target_lang)
    except Exception as e:
        print(f"Translation error: {e}")
        return text


if __name__ == "__main__":
    pass

