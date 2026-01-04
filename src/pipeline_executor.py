
import logging
import pikepdf
import os
from werkzeug.utils import secure_filename
from datetime import datetime

logger = logging.getLogger(__name__)

class PipelineExecutor:
    def __init__(self, upload_folder, output_folder):
        self.upload_folder = upload_folder
        self.output_folder = output_folder
        
    def execute(self, filename, steps):
        """
        Execute a list of steps on a PDF.
        steps: List of dicts, e.g., [{'op': 'sanitize', 'params': {...}}, {'op': 'compress'}]
        """
        current_filename = filename
        history = []
        
        # Generator to yield progress updates
        total_steps = len(steps)
        yield {'status': 'start', 'total_steps': total_steps}
        
        try:
            for i, step in enumerate(steps):
                op = step.get('op')
                params = step.get('params', {})
                
                yield {'status': 'progress', 'step_index': i, 'step_name': op, 'message': f'Running {op}...'}
                
                # Execute operation
                new_filename = self._run_operation(current_filename, op, params)
                
                history.append(new_filename)
                current_filename = new_filename
                
            yield {'status': 'complete', 'download_url': current_filename}
            
        except Exception as e:
            logger.error(f"Pipeline failed at step {op}: {e}")
            yield {'status': 'error', 'message': str(e)}

    def _run_operation(self, filename, op, params):
        # Try finding the file in output then upload folder
        potential_paths = [
            os.path.join(self.output_folder, filename),
            os.path.join(self.upload_folder, filename)
        ]
        input_path = None
        for p in potential_paths:
            if os.path.exists(p):
                input_path = p
                break
        
        if not input_path:
            raise FileNotFoundError(f"Input file {filename} not found")

        # Define Operations
        if op == 'sanitize':
            return self._op_sanitize(input_path, params)
        elif op == 'flatten':
            return self._op_flatten(input_path, params)
        elif op == 'compress':
            return self._op_compress(input_path, params)
        else:
            raise ValueError(f"Unknown operation: {op}")

    def _op_flatten(self, input_path, params):
        pdf = pikepdf.Pdf.open(input_path)
        pdf.flatten_annotations()
        
        output_filename = f"pipeline_flat_{datetime.now().strftime('%H%M%S')}_{os.path.basename(input_path)}"
        output_path = os.path.join(self.output_folder, output_filename)
        pdf.save(output_path)
        pdf.close()
        return output_filename

    def _op_sanitize(self, input_path, params):
        pdf = pikepdf.Pdf.open(input_path)
        # Apply params logic similar to sanitize endpoint
        # For MVP, just do all if no params? Or assume params passed
        
        # Simple sanitize (remove JS)
        if '/Names' in pdf.Root and '/JavaScript' in pdf.Root.Names:
            del pdf.Root.Names['/JavaScript']
            
        output_filename = f"pipeline_san_{datetime.now().strftime('%H%M%S')}_{os.path.basename(input_path)}"
        output_path = os.path.join(self.output_folder, output_filename)
        pdf.save(output_path)
        pdf.close()
        return output_filename

    def _op_compress(self, input_path, params):
        # Using simple pikepdf save with compression
        pdf = pikepdf.Pdf.open(input_path)
        output_filename = f"pipeline_comp_{datetime.now().strftime('%H%M%S')}_{os.path.basename(input_path)}"
        output_path = os.path.join(self.output_folder, output_filename)
        
        pdf.save(output_path, compress_streams=True, object_stream_mode=pikepdf.ObjectStreamMode.generate)
        pdf.close()
        return output_filename
